/**
 * BlankDelay Discord key bot
 * Commands:
 *  /genkey product:<id> [count]
 *  /lookup email:<email>
 *  /resend email:<email> product:<id>
 *  /stock
 *
 * Requires DISCORD_BOT_TOKEN. Uses same SQLite DB + email as the server.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { listProducts, getProduct } = require("../server/products");
const { createKeys, stockCounts, findByEmail, assignKey } = require("../server/keys");
const { sendFulfillmentEmail } = require("../server/email");
const { fulfillOrder } = require("../server/fulfill");

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.error("Set DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

const productChoices = listProducts().map((p) => ({ name: p.name, value: p.id }));

const commands = [
  new SlashCommandBuilder()
    .setName("genkey")
    .setDescription("Generate BlankDelay license key(s)")
    .addStringOption((o) =>
      o
        .setName("product")
        .setDescription("Product")
        .setRequired(true)
        .addChoices(...productChoices)
    )
    .addIntegerOption((o) =>
      o.setName("count").setDescription("How many keys (default 1)").setMinValue(1).setMaxValue(50)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Lookup keys by customer email")
    .addStringOption((o) => o.setName("email").setDescription("Customer email").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("resend")
    .setDescription("Resend download link + key email")
    .addStringOption((o) => o.setName("email").setDescription("Customer email").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("product")
        .setDescription("Product")
        .setRequired(true)
        .addChoices(...productChoices)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("stock")
    .setDescription("Show key stock by product")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("fulfill")
    .setDescription("Manually fulfill a purchase (assign key + email)")
    .addStringOption((o) => o.setName("email").setDescription("Customer email").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("product")
        .setDescription("Product")
        .setRequired(true)
        .addChoices(...productChoices)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

async function registerCommands() {
  if (!clientId) {
    console.warn("DISCORD_CLIENT_ID missing — skip command registration");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(token);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("Registered guild slash commands");
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Registered global slash commands");
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`BlankDelay bot online as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "genkey") {
      const productId = interaction.options.getString("product", true);
      const count = interaction.options.getInteger("count") || 1;
      const keys = createKeys(productId, count);
      await interaction.reply({
        content: `Generated **${keys.length}** key(s) for **${getProduct(productId).name}**:\n\`\`\`\n${keys.join("\n")}\n\`\`\``,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === "lookup") {
      const email = interaction.options.getString("email", true);
      const rows = findByEmail(email);
      if (!rows.length) {
        await interaction.reply({ content: `No keys for \`${email}\``, ephemeral: true });
        return;
      }
      const lines = rows.map((r) => `${r.product_id} | ${r.key_code} | ${r.status}`);
      await interaction.reply({
        content: `Keys for \`${email}\`:\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === "resend") {
      const email = interaction.options.getString("email", true);
      const productId = interaction.options.getString("product", true);
      await interaction.deferReply({ ephemeral: true });
      let keyCode;
      const existing = findByEmail(email).find((k) => k.product_id === productId);
      keyCode = existing
        ? existing.key_code
        : assignKey({ productId, email, stripeSessionId: `discord_resend_${Date.now()}` });
      const mail = await sendFulfillmentEmail({ email, productId, keyCode });
      await interaction.editReply(
        `Key: \`${keyCode}\`\nEmail sent: **${mail.sent}**${mail.reason ? ` (${mail.reason})` : ""}\nDownload: ${mail.downloadUrl}`
      );
      return;
    }

    if (interaction.commandName === "stock") {
      const rows = stockCounts();
      if (!rows.length) {
        await interaction.reply({ content: "No keys in stock yet. Use `/genkey`.", ephemeral: true });
        return;
      }
      const lines = rows.map(
        (r) => `${r.product_id}: avail=${r.available} assigned=${r.assigned} redeemed=${r.redeemed}`
      );
      await interaction.reply({ content: "```\n" + lines.join("\n") + "\n```", ephemeral: true });
      return;
    }

    if (interaction.commandName === "fulfill") {
      const email = interaction.options.getString("email", true);
      const productId = interaction.options.getString("product", true);
      await interaction.deferReply({ ephemeral: true });
      const result = await fulfillOrder({
        email,
        productId,
        stripeSessionId: `discord_${Date.now()}`,
      });
      await interaction.editReply(
        `Fulfilled **${productId}** for \`${email}\`\nKey: \`${result.keyCode}\`\nEmail sent: **${result.emailSent}**\nDownload: ${result.downloadUrl}`
      );
    }
  } catch (err) {
    console.error(err);
    const msg = err.message || String(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`Error: ${msg}`);
    } else {
      await interaction.reply({ content: `Error: ${msg}`, ephemeral: true });
    }
  }
});

registerCommands()
  .then(() => client.login(token))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
