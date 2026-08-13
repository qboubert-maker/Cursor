require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { listProducts } = require("./products");
const { createKeys, stockCounts } = require("./keys");

const perProduct = Number(process.argv[2] || 25);

for (const p of listProducts()) {
  const made = createKeys(p.id, perProduct);
  console.log(`+ ${made.length} keys → ${p.name}`);
}

console.log("\nStock:");
for (const row of stockCounts()) {
  console.log(
    `  ${row.product_id}: available=${row.available} assigned=${row.assigned} redeemed=${row.redeemed}`
  );
}
