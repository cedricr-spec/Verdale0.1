import { MERCHANTS as RAW_MERCHANTS } from "../../data/merchants"
import { getItemDefinition } from "./itemsRegistry"
import { getItemSpriteAsset } from "./itemSprites"
import { getItemAtlasInfo } from "../utils/farmingAtlasData"

const warnedMerchantIssues = new Set()

function warnMerchantIssue(merchantId, itemId, reason) {
  if (!import.meta.env.DEV) return
  const warningKey = `${merchantId}:${itemId}:${reason}`
  if (warnedMerchantIssues.has(warningKey)) return
  warnedMerchantIssues.add(warningKey)
  console.warn(`[Merchant] Invalid item skipped: ${itemId} (${merchantId}) - ${reason}`)
}

function hasValidAtlasRect(atlasRect) {
  if (!atlasRect) return false

  const x = Number(atlasRect.x ?? atlasRect.left)
  const y = Number(atlasRect.y ?? atlasRect.top)
  const width = Number(atlasRect.width ?? atlasRect.w)
  const height = Number(atlasRect.height ?? atlasRect.h)

  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  )
}

export function hasRenderableMerchantSprite(itemId) {
  if (!itemId) return false

  const farmingAtlasInfo = getItemAtlasInfo(itemId)
  if (farmingAtlasInfo?.atlasSource && hasValidAtlasRect(farmingAtlasInfo.atlasRect)) {
    return true
  }

  const itemDefinition = getItemDefinition(itemId)
  if (itemDefinition?.atlasSource && hasValidAtlasRect(itemDefinition.atlasRect)) {
    return true
  }

  const sprite = getItemSpriteAsset(itemId, "inventory") || getItemSpriteAsset(itemId, "world")
  if (sprite?.src || sprite?.sheet) {
    return true
  }

  return false
}

function hasValidPriceItems(merchantId, offer) {
  const priceItems = offer?.price?.items || []
  return priceItems.every(({ itemId }) => {
    if (!getItemDefinition(itemId)) {
      warnMerchantIssue(merchantId, itemId, "invalid price item")
      return false
    }
    if (!hasRenderableMerchantSprite(itemId)) {
      warnMerchantIssue(merchantId, itemId, "price item missing real sprite")
      return false
    }
    return true
  })
}

function isValidMerchantItem(merchantId, itemId) {
  if (!itemId) {
    warnMerchantIssue(merchantId, "unknown_item", "missing item id")
    return false
  }

  if (!getItemDefinition(itemId)) {
    warnMerchantIssue(merchantId, itemId, "missing registry definition")
    return false
  }

  if (!hasRenderableMerchantSprite(itemId)) {
    warnMerchantIssue(merchantId, itemId, "missing real sprite")
    return false
  }

  return true
}

function sanitizeSellOffer(merchantId, offer) {
  if (!isValidMerchantItem(merchantId, offer?.itemId)) return null
  if (!hasValidPriceItems(merchantId, offer)) return null
  return offer
}

function sanitizeBuyOffer(merchantId, offer) {
  if (!isValidMerchantItem(merchantId, offer?.itemId)) return null
  return offer
}

function sanitizeMerchant(merchantId, merchant) {
  if (!merchant) return null

  return {
    ...merchant,
    sells: (merchant.sells || [])
      .map((offer) => sanitizeSellOffer(merchantId, offer))
      .filter(Boolean),
    buys: (merchant.buys || [])
      .map((offer) => sanitizeBuyOffer(merchantId, offer))
      .filter(Boolean),
  }
}

export const MERCHANTS = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_MERCHANTS)
      .map(([merchantId, merchant]) => [merchantId, sanitizeMerchant(merchantId, merchant)])
      .filter(([, merchant]) => Boolean(merchant))
  )
)

export function getMerchantDefinition(merchantId) {
  return MERCHANTS[merchantId] || null
}
