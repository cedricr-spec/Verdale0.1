import { create } from "zustand"
import { MERCHANTS } from "../config/merchantCatalog"
import { useInventoryStore } from "./useInventoryStore"

function buildInitialStocks(merchantId) {
  const merchant = MERCHANTS[merchantId]
  if (!merchant) return {}
  return merchant.sells.reduce((acc, offer, index) => {
    acc[index] = offer.stock ?? Infinity
    return acc
  }, {})
}

export const useShopStore = create((set, get) => ({
  isOpen: false,
  merchantId: null,
  mode: "buy",
  merchantStocks: {},

  openShop: (merchantId) => {
    const state = get()
    let stocks = state.merchantStocks
    if (merchantId && !stocks[merchantId]) {
      stocks = { ...stocks, [merchantId]: buildInitialStocks(merchantId) }
    }
    set({ isOpen: true, merchantId, mode: "buy", merchantStocks: stocks })
  },

  closeShop: () => set({ isOpen: false, merchantId: null }),

  setShopMode: (mode) => set({ mode }),

  getOfferStock: (merchantId, offerIndex) => {
    const stocks = get().merchantStocks[merchantId]
    if (!stocks) return 0
    const stored = stocks[offerIndex]
    return stored === undefined ? Infinity : stored
  },

  buyFromMerchant: (merchantId, offerIndex) => {
    const merchant = MERCHANTS[merchantId]
    if (!merchant) return { success: false, reason: "merchant_not_found" }

    const offer = merchant.sells[offerIndex]
    if (!offer) return { success: false, reason: "offer_not_found" }

    const state = get()
    const stockMap = state.merchantStocks[merchantId] || {}
    const stock = stockMap[offerIndex] !== undefined ? stockMap[offerIndex] : (offer.stock ?? Infinity)

    if (merchant.stockMode !== "infinite" && stock !== Infinity && stock <= 0) {
      return { success: false, reason: "out_of_stock" }
    }

    const invStore = useInventoryStore.getState()
    if (!invStore.canAffordPrice(offer.price)) {
      return { success: false, reason: "cannot_afford" }
    }

    const payResult = invStore.payPrice(offer.price)
    if (!payResult.success) return { success: false, reason: payResult.reason }

    const added = invStore.addItem(offer.itemId, offer.qty ?? 1)
    if (!added) {
      // Refund — best-effort for V0
      invStore.grantPrice(offer.price)
      return { success: false, reason: "inventory_full" }
    }

    if (merchant.stockMode !== "infinite" && stock !== Infinity) {
      set((s) => ({
        merchantStocks: {
          ...s.merchantStocks,
          [merchantId]: { ...s.merchantStocks[merchantId], [offerIndex]: Math.max(0, stock - 1) },
        },
      }))
    }

    return { success: true }
  },

  sellToMerchant: (merchantId, itemId) => {
    const merchant = MERCHANTS[merchantId]
    if (!merchant) return { success: false, reason: "merchant_not_found" }

    const buyOffer = merchant.buys?.find((b) => b.itemId === itemId)
    if (!buyOffer) return { success: false, reason: "merchant_not_buying" }

    const invStore = useInventoryStore.getState()
    const owned = invStore.countItemsOwned(itemId)
    if (owned < 1) return { success: false, reason: "item_not_owned" }

    const removeResult = invStore.removeItem(itemId, 1)
    if (!removeResult.success) return { success: false, reason: "remove_failed" }

    invStore.grantPrice(buyOffer.price)

    return { success: true }
  },
}))
