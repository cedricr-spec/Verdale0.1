import React, { useCallback } from "react";
import { getItemDefinition } from "../config/itemsRegistry";
import { MERCHANTS } from "../config/merchantCatalog";
import { useInventoryStore } from "../store/useInventoryStore";
import { useShopStore } from "../store/useShopStore";
import { useWorldStore } from "../store/worldSlice";
import CurrencyDisplay from "./CurrencyDisplay";
import ItemVisual from "./ItemVisual";

const Z = 1000010;

const S = {
  backdrop: {
    position: "absolute",
    inset: 0,
    zIndex: Z,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.6)",
    pointerEvents: "auto",
  },
  panel: {
    background: "#12121e",
    border: "2px solid #3a3a5c",
    borderRadius: 8,
    fontFamily: "monospace",
    color: "#ddddf0",
    boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    width: "min(96vw, 680px)",
    maxHeight: "80vh",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px 10px",
    borderBottom: "1px solid #2a2a46",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#f0c040",
    textTransform: "uppercase",
  },
  headerMeta: {
    fontSize: 11,
    color: "#8888aa",
    marginLeft: 8,
  },
  walletChip: {
    background: "#1e1e30",
    border: "1px solid #3a3a5c",
    borderRadius: 4,
    padding: "3px 8px",
    color: "#f5d442",
    marginLeft: "auto",
    marginRight: 10,
    display: "inline-flex",
    alignItems: "center",
  },
  closeBtn: {
    background: "none",
    border: "1px solid #3a3a5c",
    borderRadius: 4,
    color: "#9090b0",
    cursor: "pointer",
    fontSize: 13,
    padding: "3px 9px",
    lineHeight: 1,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #2a2a46",
    flexShrink: 0,
  },
  tab: (active) => ({
    flex: 1,
    padding: "8px 0",
    background: active ? "#1e1e30" : "transparent",
    border: "none",
    borderBottom: active ? "2px solid #f0c040" : "2px solid transparent",
    color: active ? "#f0c040" : "#6666a0",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  }),
  body: {
    overflowY: "auto",
    flex: 1,
    padding: "10px 14px",
  },
  offerRow: (disabled) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    marginBottom: 6,
    background: disabled ? "#0e0e1a" : "#18182a",
    border: "1px solid",
    borderColor: disabled ? "#252538" : "#2e2e50",
    borderRadius: 6,
    opacity: disabled ? 0.55 : 1,
  }),
  offerIcon: {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  offerName: {
    flex: 1,
    fontSize: 12,
    color: "#c8c8e0",
  },
  offerStock: {
    fontSize: 11,
    color: "#6677aa",
    minWidth: 40,
    textAlign: "right",
  },
  priceTag: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 80,
  },
  solBadge: {
    color: "#f5d442",
    background: "#23230e",
    borderRadius: 3,
    padding: "1px 5px",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
  },
  itemBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#a0d0a0",
    background: "#0e1a0e",
    borderRadius: 3,
    padding: "1px 5px",
    whiteSpace: "nowrap",
  },
  buyBtn: (disabled) => ({
    background: disabled ? "#1a1a2a" : "#2a4a2a",
    border: "1px solid",
    borderColor: disabled ? "#2e2e44" : "#4a7a4a",
    borderRadius: 4,
    color: disabled ? "#44445a" : "#80d080",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "monospace",
    fontSize: 11,
    padding: "4px 10px",
    flexShrink: 0,
  }),
  sellBtn: (disabled) => ({
    background: disabled ? "#1a1a2a" : "#4a2a10",
    border: "1px solid",
    borderColor: disabled ? "#2e2e44" : "#7a4a20",
    borderRadius: 4,
    color: disabled ? "#44445a" : "#f0a040",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "monospace",
    fontSize: 11,
    padding: "4px 10px",
    flexShrink: 0,
  }),
  emptyHint: {
    fontSize: 12,
    color: "#44445a",
    textAlign: "center",
    padding: "24px 0",
  },
};

function MerchantItemIcon({ itemId, size = 24 }) {
  return (
    <div style={S.offerIcon}>
      <ItemVisual itemId={itemId} variant="inventory" size={size} emojiSize={size - 2} />
    </div>
  )
}

function PriceDisplay({ price }) {
  const hasSol = price?.currency?.sol > 0;
  const hasItems = price?.items?.length > 0;
  if (!hasSol && !hasItems) return <span style={{ fontSize: 11, color: "#44445a" }}>Free</span>;
  return (
    <div style={S.priceTag}>
      {hasSol && (
        <span style={S.solBadge}>
            <CurrencyDisplay
              amount={price.currency.sol}
              size={14}
              gap={4}
              title={`${price.currency.sol} sol`}
              textStyle={{
                color: "#f5d442",
                fontSize: 11,
              }}
            />
        </span>
      )}
      {hasItems &&
        price.items.map(({ itemId, qty }, i) => (
          <div key={i} style={S.itemBadge}>
            <ItemVisual itemId={itemId} variant="inventory" size={14} emojiSize={12} />
            <span>{qty}× {getItemDefinition(itemId)?.name || itemId}</span>
          </div>
        ))}
    </div>
  );
}

function BuyList({ merchant, merchantId }) {
  const wallet = useInventoryStore((s) => s.wallet);
  const canAffordPrice = useInventoryStore((s) => s.canAffordPrice);
  const getOfferStock = useShopStore((s) => s.getOfferStock);
  const buyFromMerchant = useShopStore((s) => s.buyFromMerchant);
  const merchantStocks = useShopStore((s) => s.merchantStocks);

  if (!merchant?.sells?.length) {
    return <p style={S.emptyHint}>Nothing for sale.</p>;
  }

  return merchant.sells.map((offer, index) => {
    const stock = getOfferStock(merchantId, index);
    const outOfStock = merchant.stockMode !== "infinite" && stock !== Infinity && stock <= 0;
    const canAfford = canAffordPrice(offer.price);
    const disabled = outOfStock || !canAfford;

    const stockLabel =
      merchant.stockMode === "infinite" || offer.stock === Infinity
        ? "∞"
        : `${stock} left`;

    const itemDef = getItemDefinition(offer.itemId);
    return (
      <div
        key={index}
        data-cursor={disabled ? undefined : "interactive"}
        style={S.offerRow(disabled)}
      >
        <MerchantItemIcon itemId={offer.itemId} />
        <span style={S.offerName}>
          {itemDef?.name || offer.itemId}
          {offer.qty > 1 && <span style={{ color: "#6688aa" }}> ×{offer.qty}</span>}
        </span>
        <PriceDisplay price={offer.price} />
        <span style={S.offerStock}>{stockLabel}</span>
        <button
          style={S.buyBtn(disabled)}
          disabled={disabled}
          onClick={() => !disabled && buyFromMerchant(merchantId, index)}
        >
          Buy
        </button>
      </div>
    );
  });
}

function SellList({ merchant, merchantId }) {
  const countItemsOwned = useInventoryStore((s) => s.countItemsOwned);
  const sellToMerchant = useShopStore((s) => s.sellToMerchant);

  if (!merchant?.buys?.length) {
    return <p style={S.emptyHint}>This merchant is not buying anything.</p>;
  }

  return merchant.buys.map((offer, index) => {
    const owned = countItemsOwned(offer.itemId);
    const canSell = owned >= 1;
    const itemDef = getItemDefinition(offer.itemId);

    return (
      <div
        key={index}
        data-cursor={canSell ? "interactive" : undefined}
        style={S.offerRow(!canSell)}
      >
        <MerchantItemIcon itemId={offer.itemId} />
        <span style={S.offerName}>
          {itemDef?.name || offer.itemId}
          <span style={{ color: "#6688aa", marginLeft: 6 }}>({owned} owned)</span>
        </span>
        <PriceDisplay price={offer.price} />
        <button
          style={S.sellBtn(!canSell)}
          disabled={!canSell}
          onClick={() => canSell && sellToMerchant(merchantId, offer.itemId)}
        >
          Sell
        </button>
      </div>
    );
  });
}

export default function ShopPanel() {
  const isOpen     = useShopStore((s) => s.isOpen);
  const merchantId = useShopStore((s) => s.merchantId);
  const mode       = useShopStore((s) => s.mode);
  const closeShop  = useShopStore((s) => s.closeShop);
  const setShopMode = useShopStore((s) => s.setShopMode);
  const sol        = useInventoryStore((s) => s.wallet?.sol ?? 0);

  const handleClose = useCallback(() => {
    closeShop();
    useWorldStore.getState().closeShop();
  }, [closeShop]);

  if (!isOpen || !merchantId) return null;

  const merchant = MERCHANTS[merchantId];

  return (
    <div style={S.backdrop} onClick={handleClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>
            {merchant?.name || merchantId}
          </span>
          {merchant?.title && (
          <span style={S.headerMeta}>{merchant.title}</span>
          )}
          <span style={S.walletChip}>
            <CurrencyDisplay
              amount={sol}
              size={16}
              gap={4}
              title={`${sol} sol`}
              textStyle={{
                color: "#f5d442",
                fontSize: 12,
              }}
            />
          </span>
          <button style={S.closeBtn} onClick={handleClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button style={S.tab(mode === "buy")} onClick={() => setShopMode("buy")}>
            🛒 Buy
          </button>
          <button style={S.tab(mode === "sell")} onClick={() => setShopMode("sell")}>
            Sell
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {merchant ? (
            mode === "buy" ? (
              <BuyList merchant={merchant} merchantId={merchantId} />
            ) : (
              <SellList merchant={merchant} merchantId={merchantId} />
            )
          ) : (
            <p style={S.emptyHint}>Unknown merchant: {merchantId}</p>
          )}
        </div>
      </div>
    </div>
  );
}
