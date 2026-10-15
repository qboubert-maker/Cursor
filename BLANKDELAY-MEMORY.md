# BlankDelay project memory (updated Aug 2, 2026)

**Owner:** Quincy (Blank) · qboubert@gmail.com  
**Discord:** https://discord.gg/cJafcE7y5W  
**Windows path (user machine):** C:\Users\Quincy\blankdelay  
**Cloud copies:** `/workspace/blankdelay-site` (storefront+electron) · `/workspace/blankdelay` (fulfillment)

## Brand
- Hero: “Delay? We Left That BLANK.”
- Nav: BLANKDELAY + speed-mark icon
- Reactive black/white universe + meteor shower (`background.js`)

## Download model (important)
- **One installer for all products:** `BlankDelay-Setup.exe` (~79 MB)
- Site `bd-downloads.js` always returns that hub exe
- After install → Electron Product Hub → click product → activate with license key
- Fulfillment serves product-named Setup.exe hardlinks of the same file

## 9 core products
1. Blank Premium Utility $29.99 (premium)
2. Zero Delay Plus $14.99 (zero-plus)
3. Zero Delay $9.99 (zero)
4. FPS Boost $9.99 (fps)
5. Ping Optimizer $9.99 (ping)
6. Controller Macro V2 $19.99 (controller)
7. Keyboard Macro V2 $19.99 (keyboard)
8. Aim Bundle $14.99 (aim)
9. Shotgun Pack $9.99 (shotgun)

Also: Blank Pass Full/Monthly + Gift Card (Stripe links in `bd-stripe-links.js`)

## Local URLs
- http://localhost:3000/hub — admin fulfillment
- http://localhost:3000/product-hub/hub.html — product hub UI
- http://localhost:3000/site/ — storefront
- http://localhost:3000/downloads/BlankDelay-Setup.exe

## Drive sources
- Main update: https://drive.google.com/drive/folders/12ZfA-RL9dKbSZjGYISev-dhRjROZ8kVS
- Other folder looked like node_modules junk: https://drive.google.com/drive/folders/1-Zic1_0jxF4u6WNKc3vw7oXY3dRFYBmm
