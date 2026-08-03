const BD_EMAIL_SEND = (function () {
    function formatPrice(n) {
        return '$' + Number(n).toFixed(2);
    }

    function licenseBlock(order) {
        if (order.cart && order.licenses?.length > 1) {
            return order.licenses.map(l => `${l.product}: ${l.key}`).join('\n');
        }
        return order.license || '';
    }

    function isReady() {
        return BD_EMAIL?.enabled &&
            BD_EMAIL.publicKey &&
            BD_EMAIL.serviceId &&
            BD_EMAIL.templateId &&
            typeof emailjs !== 'undefined';
    }

    function deliveryUrl(order) {
        if (typeof buildDeliveryUrl === 'function') {
            return buildDeliveryUrl(order, window.location.origin);
        }
        const slug = order.slug === 'cart' ? (order.items?.[0]?.slug || 'premium') : (order.slug || 'premium');
        const q = new URLSearchParams({ p: slug, order: order.id || '', key: order.license || '', email: order.email || '' });
        return window.location.origin + '/delivery.html?' + q.toString();
    }

    async function sendOrderEmail(order) {
        if (!isReady()) {
            return { ok: false, skipped: true, msg: 'Email not configured — add EmailJS keys in bd-email-config.js' };
        }

        const link = deliveryUrl(order);
        const downloadLink = typeof bdDownloadUrl === 'function'
            ? bdDownloadUrl(order.slug === 'cart' ? (order.items?.[0]?.slug || 'premium') : (order.slug || 'premium'))
            : 'https://blankdelay.com/downloads/BlankDelay-Setup.exe';
        const notice = typeof BD_DOWNLOAD_NOTICE !== 'undefined' ? BD_DOWNLOAD_NOTICE : null;
        const params = {
            to_email: order.email,
            customer_name: order.name || 'Customer',
            product_name: order.product,
            order_id: order.id,
            order_total: formatPrice(order.price),
            license_key: order.license || '',
            license_list: licenseBlock(order),
            delivery_link: link,
            download_link: downloadLink,
            security_notice: notice ? notice.htmlEmail : '',
            security_notice_text: notice ? notice.textPlain : '',
            reply_to: order.email
        };

        try {
            await emailjs.send(BD_EMAIL.serviceId, BD_EMAIL.templateId, params, BD_EMAIL.publicKey);
            return { ok: true, msg: 'Email sent to ' + order.email };
        } catch (err) {
            console.error('BlankDelay email error:', err);
            return { ok: false, msg: err?.text || err?.message || 'Email send failed' };
        }
    }

    return sendOrderEmail;
})();
