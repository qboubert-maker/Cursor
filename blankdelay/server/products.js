/** BlankDelay product catalog — keys, prices, download paths */

const PRODUCTS = {
  "blank-premium-utility": {
    id: "blank-premium-utility",
    name: "Blank Premium Utility",
    price: 29.99,
    description: "Featured all-in-one BlankDelay premium utility.",
    downloadPath: "/downloads/blank-premium-utility/BlankPremiumUtility-Setup.zip",
    featured: true,
  },
  "zero-delay-plus": {
    id: "zero-delay-plus",
    name: "Zero Delay Plus",
    price: 14.99,
    description: "Enhanced zero-delay performance pack.",
    downloadPath: "/downloads/zero-delay-plus/ZeroDelayPlus-Setup.zip",
  },
  "zero-delay": {
    id: "zero-delay",
    name: "Zero Delay",
    price: 9.99,
    description: "Core zero-delay optimizer.",
    downloadPath: "/downloads/zero-delay/ZeroDelay-Setup.zip",
  },
  "fps-boost": {
    id: "fps-boost",
    name: "FPS Boost",
    price: 9.99,
    description: "FPS boost utility.",
    downloadPath: "/downloads/fps-boost/FPSBoost-Setup.zip",
  },
  "ping-optimizer": {
    id: "ping-optimizer",
    name: "Ping Optimizer",
    price: 9.99,
    description: "Ping and latency optimizer.",
    downloadPath: "/downloads/ping-optimizer/PingOptimizer-Setup.zip",
  },
  "controller-macro-v2": {
    id: "controller-macro-v2",
    name: "Controller Macro V2",
    price: 19.99,
    description: "Controller macro suite V2.",
    downloadPath: "/downloads/controller-macro-v2/ControllerMacroV2-Setup.zip",
  },
  "keyboard-macro-v2": {
    id: "keyboard-macro-v2",
    name: "Keyboard Macro V2",
    price: 19.99,
    description: "Keyboard macro suite V2.",
    downloadPath: "/downloads/keyboard-macro-v2/KeyboardMacroV2-Setup.zip",
  },
  "aim-bundle": {
    id: "aim-bundle",
    name: "Aim Bundle",
    price: 14.99,
    description: "Aim pack bundle.",
    downloadPath: "/downloads/aim-bundle/AimBundle-Setup.zip",
  },
  "shotgun-pack": {
    id: "shotgun-pack",
    name: "Shotgun Pack",
    price: 9.99,
    description: "Shotgun pack utility.",
    downloadPath: "/downloads/shotgun-pack/ShotgunPack-Setup.zip",
  },
};

function listProducts() {
  return Object.values(PRODUCTS);
}

function getProduct(id) {
  return PRODUCTS[id] || null;
}

/** Resolve product from Stripe metadata or price nickname / product name */
function resolveProductFromStripe(sessionOrIntent) {
  const meta = sessionOrIntent.metadata || {};
  if (meta.product_id && PRODUCTS[meta.product_id]) {
    return PRODUCTS[meta.product_id];
  }
  const name = (meta.product_name || meta.product || "").toLowerCase();
  if (name) {
    const hit = listProducts().find(
      (p) =>
        p.name.toLowerCase() === name ||
        p.id === name.replace(/\s+/g, "-") ||
        name.includes(p.id.replace(/-/g, " "))
    );
    if (hit) return hit;
  }
  return null;
}

module.exports = {
  PRODUCTS,
  listProducts,
  getProduct,
  resolveProductFromStripe,
};
