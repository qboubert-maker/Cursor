# BlankDelay — Product Hub + Key Fulfillment + Discord Bot

This is the missing piece: **after Stripe payment succeeds**, customers get:

1. A **unique license key**
2. An **email** with the key + **download link** for that product

Stripe by itself does **not** send keys. This server does.

## Quick start (local)

```bash
cd blankdelay
cp .env.example .env
npm install
npm run seed-keys
npm start
```

Open the product hub: **http://localhost:3000/hub**

Default admin token (change in `.env`): `dev-admin-token` unless you set `ADMIN_TOKEN`.

### Test a key email without Stripe

In the hub “Admin test fulfill” box:

- Admin token from `.env`
- Buyer email
- Product
- Click **Generate key + email**

Or:

```bash
curl -X POST http://localhost:3000/api/admin/fulfill \
  -H "Content-Type: application/json" \
  -H "x-admin-token: dev-admin-token" \
  -d '{"email":"customer@email.com","productId":"shotgun-pack"}'
```

## Wire Stripe (required for automatic emails)

1. Put `STRIPE_SECRET_KEY` in `.env`
2. In Stripe Dashboard → **Developers → Webhooks** → Add endpoint:
   - URL: `https://YOUR-HOST/api/stripe/webhook`
   - Event: `checkout.session.completed`
3. Copy signing secret → `STRIPE_WEBHOOK_SECRET`
4. On every Checkout Session / Payment Link, set metadata:
   - `product_id` = one of:
     - `blank-premium-utility`
     - `zero-delay-plus`
     - `zero-delay`
     - `fps-boost`
     - `ping-optimizer`
     - `controller-macro-v2`
     - `keyboard-macro-v2`
     - `aim-bundle`
     - `shotgun-pack`

Optional: hub **Checkout** buttons call `/api/checkout` and already set `product_id` metadata.

## Email (SMTP)

Set in `.env`:

- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`
- `EMAIL_FROM`

Gmail: use an [App Password](https://myaccount.google.com/apppasswords).

If SMTP is missing, keys are still created and logged — email is skipped.

## Downloads

Each product has a download path under `downloads/`.  
Replace the placeholder files with your **real installers**, keep the same filenames so email links stay valid.

## Discord bot (manual key help)

```bash
# .env: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, optional DISCORD_GUILD_ID
npm run bot
```

Slash commands (Manage Server permission):

- `/genkey` — create keys
- `/lookup` — find keys by email
- `/resend` — resend download + key email
- `/fulfill` — manual fulfill
- `/stock` — inventory

## Host online (Render / Railway / Fly)

1. Deploy this `blankdelay` folder as a Node web service
2. Set env vars from `.env.example`
3. `PUBLIC_URL=https://your-service.onrender.com`
4. Point Stripe webhook to `https://your-service.onrender.com/api/stripe/webhook`
5. Run the Discord bot as a second process (`npm run bot`) on the same host or a worker

## Customer flow (what they should get)

1. Pay on Stripe (email collected at checkout)
2. Webhook → unique key assigned
3. Email arrives with:
   - license key
   - download link
4. Customer installs app → pastes key → unlocks

## Resend for a stuck customer

```bash
curl -X POST http://localhost:3000/api/admin/resend \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_TOKEN" \
  -d '{"email":"them@email.com","productId":"shotgun-pack"}'
```

Or Discord: `/resend email:them@email.com product:shotgun-pack`
