const productsEl = document.getElementById("products");
const testProduct = document.getElementById("testProduct");
const stuckProduct = document.getElementById("stuckProduct");
const keyResult = document.getElementById("keyResult");
const fulfillResult = document.getElementById("fulfillResult");
const stuckResult = document.getElementById("stuckResult");
const setupList = document.getElementById("setupList");

// Local default so you can test immediately
document.getElementById("adminToken").value =
  localStorage.getItem("bd_admin_token") || "dev-admin-token";

async function loadSetup() {
  const res = await fetch("/api/health");
  const h = await res.json();
  const items = [
    {
      ok: true,
      label: "Product hub server is running",
      detail: h.publicUrl || "",
    },
    {
      ok: !!h.stripe,
      label: "Stripe secret key",
      detail: h.stripe
        ? "Connected"
        : "Add STRIPE_SECRET_KEY in blankdelay/.env",
    },
    {
      ok: !!h.smtp,
      label: "Email (SMTP)",
      detail: h.smtp
        ? "Ready to send download + key emails"
        : "Add SMTP_USER + SMTP_PASS (Gmail app password) in .env",
    },
    {
      ok: false,
      label: "Stripe webhook (you set this in Stripe Dashboard)",
      detail: "Point checkout.session.completed to /api/stripe/webhook",
    },
    {
      ok: false,
      label: "Discord bot token",
      detail: "Add DISCORD_BOT_TOKEN then run: npm run bot",
    },
  ];
  setupList.innerHTML = items
    .map(
      (i) =>
        `<li class="${i.ok ? "ok" : "bad"}"><span class="dot"></span><div><strong>${i.label}</strong><br>${i.detail}</div></li>`
    )
    .join("");
}

async function loadProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  productsEl.innerHTML = "";
  testProduct.innerHTML = "";
  if (stuckProduct) stuckProduct.innerHTML = "";
  for (const p of data.products) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} ($${p.price})`;
    testProduct.appendChild(opt);
    if (stuckProduct) stuckProduct.appendChild(opt.cloneNode(true));

    const card = document.createElement("article");
    card.className = "product" + (p.featured ? " featured" : "");
    card.innerHTML = `
      <h3>${p.name}</h3>
      <div class="price">$${p.price.toFixed(2)}</div>
      <p>${p.description}</p>
      <div class="actions">
        <a class="btn" href="${p.downloadUrl}">Download</a>
        <button class="ghost checkout-btn" data-id="${p.id}">Checkout</button>
      </div>
    `;
    productsEl.appendChild(card);
  }

  document.querySelectorAll(".checkout-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const productId = btn.dataset.id;
      btn.disabled = true;
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else alert(data.error || "Checkout unavailable (set STRIPE_SECRET_KEY)");
      } catch (e) {
        alert(String(e));
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

document.getElementById("validateBtn").addEventListener("click", async () => {
  const key = document.getElementById("keyInput").value.trim();
  keyResult.textContent = JSON.stringify(await postJson("/api/keys/validate", { key }), null, 2);
});

document.getElementById("redeemBtn").addEventListener("click", async () => {
  const key = document.getElementById("keyInput").value.trim();
  keyResult.textContent = JSON.stringify(await postJson("/api/keys/redeem", { key }), null, 2);
});

async function runFulfill(email, productId, token, outEl) {
  const res = await fetch("/api/admin/fulfill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify({ email, productId }),
  });
  const data = await res.json();
  if (data.keyCode) {
    outEl.textContent =
      `SEND THIS TO THE CUSTOMER\n\n` +
      `Email: ${data.email}\n` +
      `Product: ${data.productId}\n` +
      `License key: ${data.keyCode}\n` +
      `Download: ${data.downloadUrl}\n\n` +
      `Email auto-sent: ${data.emailSent ? "YES" : "NO — copy the key+link and DM/email them yourself"}\n\n` +
      JSON.stringify(data, null, 2);
    document.getElementById("keyInput").value = data.keyCode;
  } else {
    outEl.textContent = JSON.stringify(data, null, 2);
  }
  return data;
}

document.getElementById("fulfillBtn").addEventListener("click", async () => {
  const token = document.getElementById("adminToken").value.trim();
  localStorage.setItem("bd_admin_token", token);
  const email = document.getElementById("testEmail").value.trim();
  const productId = testProduct.value;
  await runFulfill(email, productId, token, fulfillResult);
});

document.getElementById("stuckBtn").addEventListener("click", async () => {
  const token =
    document.getElementById("adminToken").value.trim() || "dev-admin-token";
  const email = document.getElementById("stuckEmail").value.trim();
  const productId = stuckProduct.value;
  if (!email) {
    stuckResult.textContent = "Enter the customer email first.";
    return;
  }
  await runFulfill(email, productId, token, stuckResult);
});

loadSetup().catch(console.error);
loadProducts().catch((e) => {
  productsEl.textContent = "Failed to load products. Is the server running?";
  console.error(e);
});
