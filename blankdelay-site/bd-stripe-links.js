/* BlankDelay - live Stripe Payment Links */
const BD_STRIPE_LINKS = {
    premium: "https://buy.stripe.com/9B628kdDc7jQdyL4Ih9bO0d",
    "zero-plus": "https://buy.stripe.com/9B66oAbv4aw2bqDcaJ9bO0c",
    zero: "https://buy.stripe.com/4gM4gsdDc47E2U7eiR9bO0e",
    fps: "https://buy.stripe.com/cNi8wI0QqbA6dyLb6F9bO0b",
    ping: "https://buy.stripe.com/9B66oAbv433A7an7Ut9bO0a",
    controller: "https://buy.stripe.com/6oUbIU1Uu47EfGTcaJ9bO09",
    keyboard: "https://buy.stripe.com/8x2bIU1UugUq0LZeiR9bO08",
    aim: "https://buy.stripe.com/8x28wI7eObA666j7Ut9bO07",
    shotgun: "https://buy.stripe.com/dRm28k56GgUq0LZ5Ml9bO06",
    "blank-pass-full": "https://buy.stripe.com/cNieV66aK5bI8er8Yx9bO05",
    "blank-pass-monthly": "https://buy.stripe.com/9B6eV6ar09rY66jdeN9bO04",
    "gift-card": "https://buy.stripe.com/cNi4gs8iS8nUgKX7Ut9bO03"
};

function bdActivePromo() {
    try { return (localStorage.getItem("bd-discount-code") || "").trim(); } catch { return ""; }
}

function bdPendingAffiliateCode() {
    try {
        const fromSession = (sessionStorage.getItem("bd-aff-pending") || "").trim();
        if (fromSession) return fromSession;
        const params = new URLSearchParams(location.search);
        return (params.get("aff") || "").trim();
    } catch {
        return "";
    }
}

function bdStripeUrl(slug) {
    const base = BD_STRIPE_LINKS[slug];
    if (!base) return null;
    const url = new URL(base);
    const code = bdActivePromo();
    if (code) url.searchParams.set("prefilled_promo_code", code);
    const aff = bdPendingAffiliateCode();
    // Stripe Payment Links pass this through on checkout.session.completed
    if (aff) url.searchParams.set("client_reference_id", aff.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 200));
    return url.toString();
}

function bdGoStripe(slug) {
    const url = bdStripeUrl(slug);
    if (url) {
        window.location.href = url;
        return true;
    }
    return false;
}

function bdSyncStripeLinks() {
    document.querySelectorAll("[data-slug]").forEach(el => {
        const slug = el.dataset.slug;
        const url = bdStripeUrl(slug);
        if (url && el.tagName === "A") el.href = url;
    });
    document.querySelectorAll("[data-buy-slug]").forEach(el => {
        const url = bdStripeUrl(el.dataset.buySlug);
        if (url && el.tagName === "A") el.href = url;
    });
}

document.addEventListener("DOMContentLoaded", bdSyncStripeLinks);
