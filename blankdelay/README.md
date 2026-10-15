# BlankDelay fulfillment + product hub

License keys, Stripe webhook fulfillment, email delivery, Discord bot, and download hosting for BlankDelay.

## Quick start
```bash
cd blankdelay
npm install
npm run seed-keys   # optional stock
npm run build-downloads
npm start
```

- Admin hub: http://localhost:3000/hub
- Electron product hub: http://localhost:3000/product-hub/hub.html
- Storefront (imported update): http://localhost:3000/site/
- Installer: http://localhost:3000/downloads/BlankDelay-Setup.exe

## Downloads
One real Windows installer powers every product:

`downloads/BlankDelay-Setup.exe`

`npm run build-downloads` hard-links it to product-named files such as:

`downloads/zero-delay-plus/BlankDelay-Zero-Delay-Plus-Setup.exe`

## Site update
Imported storefront + Electron apps live in `../blankdelay-site/`.  
See `SITE-UPDATE.md` for products, Stripe links, and architecture notes.
