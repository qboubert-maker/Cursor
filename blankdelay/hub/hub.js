const productsEl = document.getElementById("products");
const testProduct = document.getElementById("testProduct");
const keyResult = document.getElementById("keyResult");
const fulfillResult = document.getElementById("fulfillResult");

async function loadProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  productsEl.innerHTML = "";
  testProduct.innerHTML = "";
  for (const p of data.products) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} ($${p.price})`;
    testProduct.appendChild(opt);

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

document.getElementById("fulfillBtn").addEventListener("click", async () => {
  const token = document.getElementById("adminToken").value.trim();
  const email = document.getElementById("testEmail").value.trim();
  const productId = testProduct.value;
  const res = await fetch("/api/admin/fulfill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify({ email, productId }),
  });
  const data = await res.json();
  fulfillResult.textContent = JSON.stringify(data, null, 2);
  if (data.keyCode) document.getElementById("keyInput").value = data.keyCode;
});

loadProducts().catch((e) => {
  productsEl.textContent = "Failed to load products. Is the server running?";
  console.error(e);
});
