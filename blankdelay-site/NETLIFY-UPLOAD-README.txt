================================================================================
  BLANKDELAY — DRAG THIS ENTIRE FOLDER ONTO NETLIFY
================================================================================

WHAT THIS IS
  Complete blankdelay.com site + Stripe webhook + download redirects.

  Desktop .exe builds are on GitHub Releases (Netlify max file size).
  /downloads/BlankDelay-Setup.exe and Controller Macro URLs redirect there.

HOW TO UPLOAD (Netlify)
  1. Unzip BlankDelay-Netlify-Upload.zip
  2. Open the folder — index.html must be at the TOP level
  3. Drag the WHOLE folder onto Netlify → Deploys → drop zone
     OR zip the CONTENTS (not a parent wrapper folder) and upload

AFTER UPLOAD — READ: AFTER-DEPLOY-EMAIL-SETUP.txt

QUICK TESTS
  • https://blankdelay.com/.netlify/functions/stripe-webhook → Method not allowed
  • https://blankdelay.com/downloads/BlankDelay-Setup.exe → starts Hub download
  • https://blankdelay.com/downloads/BlankDelay-Controller-Macro-V2-Setup.exe
    → Controller Macro (Drive redesign)

INCLUDED
  ✓ Storefront (index.html, cart, Stripe payment links)
  ✓ Download redirects for Hub + Controller Macro + product-named Setup URLs
  ✓ netlify/functions (stripe-webhook, get-fulfillment, license-key)
  ✓ thank-you.html / delivery.html / EmailJS hooks
  ✓ Updated electron/ source (for reference; customers use the .exe downloads)

Discord keys: https://discord.gg/5gyVpYMY9
