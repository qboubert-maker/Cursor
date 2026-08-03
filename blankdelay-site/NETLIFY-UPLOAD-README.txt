================================================================================
  BLANKDELAY — DRAG THIS ENTIRE FOLDER ONTO NETLIFY
================================================================================

WHAT THIS IS
  Complete blankdelay.com site + Stripe webhook + downloads + EmailJS hooks.

  License keys are NOT stored in this folder. When someone pays, Stripe calls
  netlify/functions/stripe-webhook.js → creates BD-XXXX-XXXX-XXXX → EmailJS
  emails their key + product download link.

HOW TO UPLOAD (Netlify)
  1. Select ALL files inside this folder (index.html must be at the top level).
  2. Zip them OR drag this whole folder to Netlify → Deploys → drop zone.
  3. WRONG: zipping a parent so the zip only contains "blankdelay-netlify-deploy/"
     with index.html inside — open your zip and fix if needed.

AFTER UPLOAD — READ: AFTER-DEPLOY-EMAIL-SETUP.txt (same folder)

QUICK TESTS (after deploy)
  • https://blankdelay.com/.netlify/functions/stripe-webhook → 405 (not 404)
  • https://blankdelay.com/downloads/BlankDelay-Setup.exe → downloads ~79 MB
  • https://blankdelay.com/downloads/BlankDelay-Zero-Delay-Plus-Setup.exe → same file

INCLUDED
  ✓ Storefront (index.html, cart, Stripe payment links)
  ✓ downloads/BlankDelay-Setup.exe (Product Hub installer for all 9 products)
  ✓ Product-named .exe URLs (Netlify rewrites → same installer)
  ✓ netlify/functions/stripe-webhook.js (auto key + email on purchase)
  ✓ EmailJS config (bd-email-config.js)
  ✓ delivery.html / thank-you.html
  ✓ electron/ (source for desktop apps — customers use the .exe, not this folder)

Discord: https://discord.gg/cJafcE7y5W
