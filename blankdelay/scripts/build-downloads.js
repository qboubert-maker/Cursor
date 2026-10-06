/**
 * Links the official BlankDelay-Setup.exe into per-product download names.
 * One real Windows installer (~79MB) powers every product; the hub unlocks by key.
 */
const fs = require("fs");
const path = require("path");
const { listProducts, setupExeName } = require("../server/products");

const root = path.join(__dirname, "..");
const downloadsRoot = path.join(root, "downloads");
const masterExe = path.join(downloadsRoot, "BlankDelay-Setup.exe");

function ensureMasterExe() {
  const siteCopy = path.join(root, "..", "blankdelay-site", "downloads", "BlankDelay-Setup.exe");
  if (fs.existsSync(masterExe) && fs.statSync(masterExe).size > 1_000_000) return masterExe;
  if (fs.existsSync(siteCopy) && fs.statSync(siteCopy).size > 1_000_000) {
    fs.mkdirSync(downloadsRoot, { recursive: true });
    fs.copyFileSync(siteCopy, masterExe);
    return masterExe;
  }
  throw new Error(
    "Missing BlankDelay-Setup.exe. Put it at blankdelay/downloads/BlankDelay-Setup.exe (from the Drive update)."
  );
}

function linkOrCopy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  try {
    fs.linkSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
  }
}

function main() {
  const src = ensureMasterExe();
  const size = fs.statSync(src).size;
  console.log("Master installer:", src, `(${Math.round(size / 1024 / 1024)} MB)`);

  for (const product of listProducts()) {
    const dir = path.join(downloadsRoot, product.id);
    fs.mkdirSync(dir, { recursive: true });

    const exeName = setupExeName(product.name);
    const exePath = path.join(dir, exeName);

    // Remove old placeholder zips / html apps
    for (const f of fs.readdirSync(dir)) {
      if (f === exeName || f === "README.txt") continue;
      fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    }

    linkOrCopy(src, exePath);
    fs.writeFileSync(
      path.join(dir, "README.txt"),
      `BlankDelay — ${product.name}

1. Double-click ${exeName}
2. Install the BlankDelay Desktop App
3. Open the Product Hub and launch ${product.name}
4. Activate with the license key from your purchase email

This is the official BlankDelay Setup (same hub app for all products).
Your license key unlocks the product you bought.

Product ID: ${product.id}
`,
      "utf8"
    );
    console.log("Ready", exeName);
  }
  console.log("Done. Product .exe downloads point at BlankDelay-Setup.exe.");
}

main();
