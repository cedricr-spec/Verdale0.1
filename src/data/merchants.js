export const MERCHANTS = {
  market_01: {
    id: "market_01",
    name: "Mira",
    title: "General Merchant",
    stockMode: "limited",
    sells: [
      {
        itemId: "candy",
        qty: 1,
        stock: 10,
        price: { currency: { sol: 10 }, items: [] },
      },
      {
        itemId: "candy_pink",
        qty: 1,
        stock: 8,
        price: { currency: { sol: 14 }, items: [] },
      },
      {
        itemId: "milk",
        qty: 1,
        stock: 6,
        price: { currency: { sol: 24 }, items: [] },
      },
      {
        itemId: "ice_cream",
        qty: 1,
        stock: 5,
        price: { currency: { sol: 22 }, items: [] },
      },
      {
        itemId: "honey",
        qty: 1,
        stock: 4,
        price: { currency: { sol: 38 }, items: [] },
      },
    ],
    buys: [
      { itemId: "wood_log", price: { currency: { sol: 2 }, items: [] } },
      { itemId: "stone", price: { currency: { sol: 2 }, items: [] } },
      { itemId: "carrot_food", price: { currency: { sol: 4 }, items: [] } },
      { itemId: "potato_food", price: { currency: { sol: 5 }, items: [] } },
    ],
  },

  blacksmith_01: {
    id: "blacksmith_01",
    name: "Forge",
    title: "Blacksmith",
    stockMode: "limited",
    sells: [
      {
        itemId: "crystal_gem_2",
        qty: 1,
        stock: 4,
        price: { currency: { sol: 120 }, items: [] },
      },
      {
        itemId: "crystal_gem_3",
        qty: 1,
        stock: 2,
        price: { currency: { sol: 220 }, items: [] },
      },
      {
        itemId: "crystal_gem_4",
        qty: 1,
        stock: 1,
        price: { currency: { sol: 340 }, items: [] },
      },
      {
        itemId: "complete_crystal_gem",
        qty: 1,
        stock: 1,
        price: { currency: { sol: 650 }, items: [] },
      },
    ],
    buys: [
      { itemId: "gears", price: { currency: { sol: 4 }, items: [] } },
    ],
  },
};
