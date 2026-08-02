/**
 * Builds real .zip installers for each BlankDelay product.
 * Each zip contains a product app (HTML) + Windows launcher.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { listProducts } = require("../server/products");

const root = path.join(__dirname, "..");
const downloadsRoot = path.join(root, "downloads");

function productFileBase(product) {
  // BlankDelay-Blank-Premium-Utility
  return `BlankDelay-${product.name.replace(/\s+/g, "-")}`;
}

function buildProductHtml(product) {
  const title = `BlankDelay — ${product.name}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@500&display=swap");
    :root { --bg:#07080c; --text:#f3f5f7; --muted:#9aa3ad; --accent:#d8ff3d; --ok:#6dffb0; --bad:#ff5d6c; --line:rgba(255,255,255,.12); }
    *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family:"Space Grotesk",sans-serif;color:var(--text);
      background:radial-gradient(900px 420px at 20% -10%,rgba(109,255,176,.16),transparent 60%),linear-gradient(180deg,#10131a,#07080c);}
    .wrap{max-width:560px;margin:0 auto;padding:40px 20px}
    .brand{letter-spacing:.14em;font-weight:700;font-size:.9rem;margin-bottom:10px}
    h1{margin:0 0 8px;font-size:1.8rem} .sub{color:var(--muted);margin:0 0 22px}
    .card{border:1px solid var(--line);border-radius:16px;padding:18px;background:rgba(255,255,255,.03)}
    .row{display:flex;gap:8px;flex-wrap:wrap}
    input{flex:1;min-width:180px;border-radius:10px;border:1px solid var(--line);background:#0c0f14;color:var(--text);padding:12px;font:inherit}
    button{border:0;border-radius:10px;padding:12px 16px;background:var(--accent);color:#111;font-weight:700;cursor:pointer}
    .status{margin-top:14px;padding:12px;border-radius:10px;border:1px solid var(--line);font-family:"IBM Plex Mono",monospace;font-size:.82rem;white-space:pre-wrap}
    .status.ok{border-color:rgba(109,255,176,.5);color:var(--ok)}
    .status.bad{border-color:rgba(255,93,108,.5);color:#ff8b96}
    .panel{margin-top:16px;display:none}.panel.show{display:block}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    .tile{border:1px solid var(--line);border-radius:12px;padding:14px;background:rgba(0,0,0,.25)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">BLANKDELAY</div>
    <h1>${product.name}</h1>
    <p class="sub">$${product.price.toFixed(2)} · Paste your license key to unlock this product.</p>
    <div class="card">
      <div class="row">
        <input id="key" placeholder="YOUR-LICENSE-KEY" />
        <button id="go">Activate</button>
      </div>
      <div id="status" class="status">Waiting for key…</div>
      <div id="panel" class="panel">
        <strong>${product.name} unlocked</strong>
        <div class="grid">
          <div class="tile">Status: Active</div>
          <div class="tile">Product ID: ${product.id}</div>
          <div class="tile">Engine: Ready</div>
          <div class="tile">License: Valid</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const PRODUCT_ID = ${JSON.stringify(product.id)};
    const API = localStorage.getItem("blankdelay_api") || "http://localhost:3000";
    const status = document.getElementById("status");
    const panel = document.getElementById("panel");
    document.getElementById("go").onclick = async () => {
      const key = document.getElementById("key").value.trim();
      status.className = "status";
      status.textContent = "Checking key…";
      panel.classList.remove("show");
      try {
        const res = await fetch(API + "/api/keys/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key })
        });
        const data = await res.json();
        if (data.valid && data.productId === PRODUCT_ID) {
          status.className = "status ok";
          status.textContent = "ACTIVATED\\nKey status: " + data.status;
          panel.classList.add("show");
          try {
            await fetch(API + "/api/keys/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key })
            });
          } catch (_) {}
        } else if (data.valid) {
          status.className = "status bad";
          status.textContent = "This key is for a different product: " + data.productId;
        } else {
          status.className = "status bad";
          status.textContent = "Invalid key. Buy/get a key for ${product.name}.";
        }
      } catch (e) {
        status.className = "status bad";
        status.textContent = "Could not reach BlankDelay server at " + API + "\\nStart the hub (npm start), then try again.\\n\\n" + e;
      }
    };
  </script>
</body>
</html>
`;
}

function buildLauncherBat(product, htmlName) {
  return `@echo off
title BlankDelay - ${product.name}
cd /d "%~dp0"
start "" "%~dp0${htmlName}"
`;
}

function buildReadme(product, zipName) {
  return `BlankDelay — ${product.name}

1. Unzip this file
2. Double-click "Open BlankDelay ${product.name}.bat"
   (or open the .html file)
3. Paste your license key and click Activate

Zip name: ${zipName}
Product ID: ${product.id}
`;
}

function main() {
  for (const product of listProducts()) {
    const dir = path.join(downloadsRoot, product.id);
    fs.mkdirSync(dir, { recursive: true });

    const base = productFileBase(product);
    const htmlName = `${base}.html`;
    const batName = `Open BlankDelay ${product.name}.bat`;
    const zipName = `${base}.zip`;
    const zipPath = path.join(dir, zipName);

    const staging = path.join(dir, "_staging");
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });

    fs.writeFileSync(path.join(staging, htmlName), buildProductHtml(product), "utf8");
    fs.writeFileSync(path.join(staging, batName), buildLauncherBat(product, htmlName), "utf8");
    fs.writeFileSync(path.join(staging, "README.txt"), buildReadme(product, zipName), "utf8");

    // Remove old placeholder zips / junk
    for (const f of fs.readdirSync(dir)) {
      if (f === "_staging") continue;
      fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    }

    execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: staging });
    fs.rmSync(staging, { recursive: true, force: true });

    // Keep a copy of html outside zip for direct hub preview too
    fs.writeFileSync(path.join(dir, htmlName), buildProductHtml(product), "utf8");

    console.log("Built", zipName);
  }
  console.log("Done. Real zip downloads are ready.");
}

main();
