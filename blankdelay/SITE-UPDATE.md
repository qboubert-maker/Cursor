# BlankDelay site update (imported Aug 2026)

Source Drive folders:
- https://drive.google.com/drive/folders/12ZfA-RL9dKbSZjGYISev-dhRjROZ8kVS (main site + Setup.exe + Electron)
- https://drive.google.com/drive/folders/1-Zic1_0jxF4u6WNKc3vw7oXY3dRFYBmm (appeared to be node_modules / tooling junk — not used)

## Local copies
- Website: `/workspace/blankdelay-site/` (also served at http://localhost:3000/site/)
- Fulfillment + hub: `/workspace/blankdelay/`
- Official installer: `blankdelay/downloads/BlankDelay-Setup.exe` (~79 MB)

## How downloads work now
- One Windows installer for **all** products: `BlankDelay-Setup.exe`
- Site `bd-downloads.js` points every product at that hub installer
- After install, Electron Product Hub launches each app (`electron/hub.html` + `electron/products/*.html`)
- Fulfillment emails / hub download buttons serve product-named copies of the same Setup.exe
  (e.g. `BlankDelay-Zero-Delay-Plus-Setup.exe`) so the file name matches the purchase

## Products + live Stripe Payment Links
| Slug | Product | Price | Stripe |
|------|---------|-------|--------|
| premium | Blank Premium Utility | $29.99 | buy.stripe.com/9B628kdDc7jQdyL4Ih9bO0d |
| zero-plus | Zero Delay Plus | $14.99 | buy.stripe.com/9B66oAbv4aw2bqDcaJ9bO0c |
| zero | Zero Delay | $9.99 | buy.stripe.com/4gM4gsdDc47E2U7eiR9bO0e |
| fps | FPS Boost | $9.99 | buy.stripe.com/cNi8wI0QqbA6dyLb6F9bO0b |
| ping | Ping Optimizer | $9.99 | buy.stripe.com/9B66oAbv433A7an7Ut9bO0a |
| controller | Controller Macro V2 | $19.99 | buy.stripe.com/6oUbIU1Uu47EfGTcaJ9bO09 |
| keyboard | Keyboard Macro V2 | $19.99 | buy.stripe.com/8x2bIU1UugUq0LZeiR9bO08 |
| aim | Aim Bundle | $14.99 | buy.stripe.com/8x28wI7eObA666j7Ut9bO07 |
| shotgun | Shotgun Pack | $9.99 | buy.stripe.com/dRm28k56GgUq0LZ5Ml9bO06 |
| blank-pass-full | Blank Pass — Full Kit | — | buy.stripe.com/cNieV66aK5bI8er8Yx9bO05 |
| blank-pass-monthly | Blank Pass Monthly | — | buy.stripe.com/9B6eV6ar09rY66jdeN9bO04 |
| gift-card | Gift Card | — | buy.stripe.com/cNi4gs8iS8nUgKX7Ut9bO03 |

## Stack (updated)
- Static storefront: `index.html`, `styles.css`, `main.js`, `background.js`, cart/checkout/delivery/thank-you
- Stripe: `bd-stripe-links.js`
- Downloads: `bd-downloads.js` → single Setup.exe
- Delivery UI: `delivery.html` / `delivery.js`, `email-delivery.js`, `thank-you.*`
- Electron desktop: `electron/main.js`, `electron/hub.html`, `electron/products/*`, launch-*.bat
- Hosting config: `netlify.toml` + `netlify/`

## Local URLs
- Fulfillment admin hub: http://localhost:3000/hub
- Electron product hub (HTML): http://localhost:3000/product-hub/hub.html
- Storefront preview: http://localhost:3000/site/
- Shared installer: http://localhost:3000/downloads/BlankDelay-Setup.exe
