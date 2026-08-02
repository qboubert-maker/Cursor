# BlankDelay — do these in order

I already built and started the hub + key system.  
**You** still need to add Stripe / Gmail / Discord secrets (I can’t log into your accounts).

## Done for you already
- [x] Product hub running
- [x] Unique key generator for all 9 products
- [x] Download links for each product
- [x] Stripe webhook code ready
- [x] Email code ready
- [x] Discord bot code ready
- [x] “Help a stuck customer” button in the hub

Open hub: **http://localhost:3000/hub**

---

## STEP 1 — Help any customer who already paid (do this first)
1. Open http://localhost:3000/hub
2. In **Help a stuck customer**:
   - paste their email
   - pick the product they bought
   - click **Make key + download link**
3. Copy the key + download link
4. Send it to them on Discord/email

Admin token (local): `dev-admin-token`

---

## STEP 2 — Turn on email sending (Gmail)
1. Go to Google Account → Security → turn on 2-Step Verification
2. Create an **App Password**: https://myaccount.google.com/apppasswords
3. Open `blankdelay/.env` and set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourgmail@gmail.com
   SMTP_PASS=the-16-char-app-password
   EMAIL_FROM="BlankDelay <yourgmail@gmail.com>"
   ```
4. Restart the server (`Ctrl+C` then `npm start` in `blankdelay`)
5. Test fulfill again — `emailSent` should become `true`

---

## STEP 3 — Connect Stripe so future buyers get keys automatically
1. Stripe Dashboard → Developers → API keys  
   Copy **Secret key** → put in `.env` as `STRIPE_SECRET_KEY`
2. Stripe → Developers → Webhooks → **Add endpoint**
   - URL: `https://YOUR-LIVE-HOST/api/stripe/webhook`  
     (for local testing use Stripe CLI — see below)
   - Event: `checkout.session.completed`
3. Copy webhook **Signing secret** → `STRIPE_WEBHOOK_SECRET` in `.env`
4. On every Payment Link / Checkout, add metadata:
   - key: `product_id`
   - value: one of  
     `blank-premium-utility` `zero-delay-plus` `zero-delay` `fps-boost`  
     `ping-optimizer` `controller-macro-v2` `keyboard-macro-v2`  
     `aim-bundle` `shotgun-pack`

### Local Stripe test (optional)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Paste the `whsec_...` it prints into `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## STEP 4 — Put your real software in the download folders
Replace the placeholder files (keep the same names):

- `downloads/blank-premium-utility/BlankPremiumUtility-Setup.zip`
- `downloads/zero-delay-plus/ZeroDelayPlus-Setup.zip`
- `downloads/zero-delay/ZeroDelay-Setup.zip`
- `downloads/fps-boost/FPSBoost-Setup.zip`
- `downloads/ping-optimizer/PingOptimizer-Setup.zip`
- `downloads/controller-macro-v2/ControllerMacroV2-Setup.zip`
- `downloads/keyboard-macro-v2/KeyboardMacroV2-Setup.zip`
- `downloads/aim-bundle/AimBundle-Setup.zip`
- `downloads/shotgun-pack/ShotgunPack-Setup.zip`

---

## STEP 5 — Host online (so Stripe can reach the webhook)
1. Deploy the `blankdelay` folder to Render / Railway / Fly
2. Set the same `.env` values there
3. Set `PUBLIC_URL=https://your-site.com`
4. Point Stripe webhook to `https://your-site.com/api/stripe/webhook`

---

## STEP 6 — Discord bot (optional but useful)
1. Discord Developer Portal → New Application → Bot → copy token
2. OAuth2 → copy Client ID
3. Invite bot to your server with `applications.commands` + Manage Server
4. In `.env`:
   ```
   DISCORD_BOT_TOKEN=...
   DISCORD_CLIENT_ID=...
   DISCORD_GUILD_ID=your-server-id
   ```
5. Run: `npm run bot`
6. Use `/fulfill` or `/resend` for stuck buyers

---

## When it’s fully working
Buyer pays → Stripe webhook fires → unique key created → email sends with download + key → they activate in the app.
