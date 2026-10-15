# BlankDelay — do these in order

I already imported your Drive site update, wired the real **BlankDelay-Setup.exe**, and started the hubs.  
**You** still need to add Stripe / Gmail / Discord secrets (I can’t log into your accounts).

## Done for you already
- [x] Site update copied to `blankdelay-site/`
- [x] Official `BlankDelay-Setup.exe` (~79 MB) in downloads
- [x] Per-product Setup.exe download names (same installer)
- [x] Product hub + Electron product hub + storefront preview
- [x] Unique key generator for all 9 products
- [x] Stripe webhook + email code ready
- [x] Discord bot code ready
- [x] “Help a stuck customer” button in the hub

## Open these
- Admin / fulfillment hub: **http://localhost:3000/hub**
- Electron Product Hub: **http://localhost:3000/product-hub/hub.html**
- Storefront preview: **http://localhost:3000/site/**
- Shared installer: **http://localhost:3000/downloads/BlankDelay-Setup.exe**

---

## STEP 1 — Help any customer who already paid (do this first)
1. Open http://localhost:3000/hub
2. In **Help a stuck customer**:
   - paste their email
   - pick the product they bought
   - click **Make key + download link**
3. Copy the key + download link (ends in `…-Setup.exe`)
4. Send it to them on Discord/email

Admin token (local): `dev-admin-token`

---

## STEP 2 — Turn on email sending (Gmail)
1. Google Account → Security → 2-Step Verification on
2. App Password: https://myaccount.google.com/apppasswords
3. In `blankdelay/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourgmail@gmail.com
   SMTP_PASS=the-16-char-app-password
   EMAIL_FROM="BlankDelay <yourgmail@gmail.com>"
   ```
4. Restart: `npm start` in `blankdelay`
5. Test fulfill — `emailSent` should be `true`

---

## STEP 3 — Connect Stripe for automatic keys
1. Stripe → Developers → API keys → `STRIPE_SECRET_KEY` in `.env`
2. Webhooks → Add endpoint → `checkout.session.completed` → `/api/stripe/webhook`
3. Webhook signing secret → `STRIPE_WEBHOOK_SECRET`
4. On each Payment Link, metadata:
   - `product_id` = one of  
     `blank-premium-utility` `zero-delay-plus` `zero-delay` `fps-boost`  
     `ping-optimizer` `controller-macro-v2` `keyboard-macro-v2`  
     `aim-bundle` `shotgun-pack`

Live Payment Links already exist in `blankdelay-site/bd-stripe-links.js`.

---

## STEP 4 — Downloads (already real)
Each product download is a named copy of:

`downloads/BlankDelay-Setup.exe`

Rebuild links anytime:

```bash
cd blankdelay && npm run build-downloads
```

On Windows, customers run the `.exe`, then open the Product Hub and launch their product.

---

## STEP 5 — Host online
1. Deploy `blankdelay` (fulfillment) + serve `blankdelay-site` (storefront)
2. Set `.env` + `PUBLIC_URL=https://your-domain`
3. Point Stripe webhook to `https://your-domain/api/stripe/webhook`
4. Production download URL can stay `https://blankdelay.com/downloads/BlankDelay-Setup.exe`

---

## STEP 6 — Discord bot (optional)
1. Discord Developer Portal → Bot token
2. `.env`: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
3. `npm run bot`
4. `/fulfill` or `/resend` for stuck buyers

---

## When it’s fully working
Buyer pays → Stripe webhook → unique key → email with Setup.exe + key → install → hub → activate.
