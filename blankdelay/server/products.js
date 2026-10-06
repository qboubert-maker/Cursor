/** BlankDelay product catalog — keys, prices, download paths */

function setupExeName(productName) {
  return `BlankDelay-${productName.replace(/\s+/g, "-")}-Setup.exe`;
}

const PRODUCTS = {
  "blank-premium-utility": {
    id: "blank-premium-utility",
    slug: "premium",
    name: "Blank Premium Utility",
    price: 29.99,
    description: "All-in-one optimization — FPS, input, network & OS.",
    downloadPath: `/downloads/blank-premium-utility/${setupExeName("Blank Premium Utility")}`,
    featured: true,
  },
  "zero-delay-plus": {
    id: "zero-delay-plus",
    slug: "zero-plus",
    name: "Zero Delay Plus",
    price: 14.99,
    description: "Enhanced zero delay + advanced FPS optimizations.",
    downloadPath: `/downloads/zero-delay-plus/${setupExeName("Zero Delay Plus")}`,
  },
  "zero-delay": {
    id: "zero-delay",
    slug: "zero",
    name: "Zero Delay",
    price: 9.99,
    description: "Quantum delay engine — eliminate input lag.",
    downloadPath: `/downloads/zero-delay/${setupExeName("Zero Delay")}`,
  },
  "fps-boost": {
    id: "fps-boost",
    slug: "fps",
    name: "FPS Boost",
    price: 9.99,
    description: "Dynamic frame stabilizer for max frame rate.",
    downloadPath: `/downloads/fps-boost/${setupExeName("FPS Boost")}`,
  },
  "ping-optimizer": {
    id: "ping-optimizer",
    slug: "ping",
    name: "Ping Optimizer",
    price: 9.99,
    description: "Lower ping and reduce network jitter.",
    downloadPath: `/downloads/ping-optimizer/${setupExeName("Ping Optimizer")}`,
  },
  "controller-macro-v2": {
    id: "controller-macro-v2",
    slug: "controller",
    name: "Controller Macro V2",
    price: 19.99,
    description: "Advanced controller macros V2.00.",
    downloadPath: `/downloads/controller-macro-v2/${setupExeName("Controller Macro V2")}`,
  },
  "keyboard-macro-v2": {
    id: "keyboard-macro-v2",
    slug: "keyboard",
    name: "Keyboard Macro V2",
    price: 19.99,
    description: "Lightning-fast keyboard macro sequences V2.0.",
    downloadPath: `/downloads/keyboard-macro-v2/${setupExeName("Keyboard Macro V2")}`,
  },
  "aim-bundle": {
    id: "aim-bundle",
    slug: "aim",
    name: "Aim Bundle",
    price: 14.99,
    description: "3D first-person aim trainer + Fortnite sensitivity.",
    downloadPath: `/downloads/aim-bundle/${setupExeName("Aim Bundle")}`,
  },
  "shotgun-pack": {
    id: "shotgun-pack",
    slug: "shotgun",
    name: "Shotgun Pack",
    price: 9.99,
    description: "Close-range shotgun box-fight trainer.",
    downloadPath: `/downloads/shotgun-pack/${setupExeName("Shotgun Pack")}`,
  },
  "blank-pass-full": {
    id: "blank-pass-full",
    slug: "blank-pass-full",
    name: "Blank Pass — Full Kit",
    price: 0,
    description: "Blank Pass full kit access.",
    downloadPath: "/downloads/BlankDelay-Setup.exe",
  },
  "blank-pass-monthly": {
    id: "blank-pass-monthly",
    slug: "blank-pass-monthly",
    name: "Blank Pass Monthly",
    price: 0,
    description: "Blank Pass monthly access.",
    downloadPath: "/downloads/BlankDelay-Setup.exe",
  },
};

function listProducts() {
  // Hub catalog: core 9 sellable apps (exclude pass SKUs from main grid unless priced)
  return Object.values(PRODUCTS).filter((p) =>
    [
      "blank-premium-utility",
      "zero-delay-plus",
      "zero-delay",
      "fps-boost",
      "ping-optimizer",
      "controller-macro-v2",
      "keyboard-macro-v2",
      "aim-bundle",
      "shotgun-pack",
    ].includes(p.id)
  );
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
  const slug = (meta.slug || "").toLowerCase();
  if (slug) {
    const bySlug = Object.values(PRODUCTS).find((p) => p.slug === slug);
    if (bySlug) return bySlug;
  }
  const name = (meta.product_name || meta.product || "").toLowerCase();
  if (name) {
    const hit = Object.values(PRODUCTS).find(
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
  setupExeName,
};
