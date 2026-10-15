# Blank Delay

The Blank Delay product site. One scroll-driven 3D scene (React Three Fiber) sits behind an HTML overlay, and a GSAP ScrollTrigger timeline drives both from the same clock.

## Running it

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

The dev server prints a local URL. `npm run build` writes production files to `dist/`, and `npm run preview` serves that build.

## Environment

Copy `.env.example` to `.env` and fill it in. `.env` is never committed.

| Key | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-side Stripe key. Never prefix it with `VITE_`. |
| `VITE_DISCORD_URL` | Discord invite used by the nav, product theater, and download screen. |

Without `STRIPE_SECRET_KEY`, Buy now skips Stripe and opens the download screen directly so the design stays reviewable in development. In production the checkout endpoint returns an error instead.

## Payment and delivery

1. Buy now posts to `/api/create-checkout-session` and redirects to Stripe Checkout.
2. Stripe returns to `/?checkout=success&session_id=...`, which is verified against the Stripe API.
3. A paid session unlocks the download screen, which pulls the build from `/api/download`.

Product builds are not in this repo. Create a `downloads/` folder at the project root and drop one archive per product, named by product id — `controller-macro.zip`, `keyboard-macro.zip`, `zero-delay-os.zip`, `fps-boost.zip`, `premium-utility.zip`. A single `blank-delay.zip` is used as a fallback. That folder is gitignored.

Prices live in `src/lib/checkoutCatalog.js` and are stored in cents. The Aim Bundle is marked coming soon and cannot be purchased.

## Layout

```
api/            Stripe checkout session, session lookup, and file delivery
public/         3D models, textures, game covers, and product demo media
src/
  components/   Scene pieces, the HTML overlay, and the product theater
  lib/          Scroll rig, smooth scroll, quality tiers, product catalog, demo slides
vite.config.js  Build config plus the dev-time payment API routes
```

`src/lib/rig.js` is the spine. It holds the mutable scene state the timeline writes into every frame, the chapter list, and the scroll positions the nav jumps to. Scrolling never re-renders React — GSAP writes into `rig`, and the scene reads it inside `useFrame`.

`src/lib/quality.js` picks render settings from the device's core count, memory, and pixel ratio, and the scene lowers them further on weak GPUs.
