(function () {
    const $ = id => document.getElementById(id);
    const formatPrice = n => '$' + n.toFixed(2);

    function showToast(msg) {
        let toast = $('cart-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cart-toast';
            toast.className = 'cart-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    function updateBadge() {
        BD_STORE.sanitizeCart();
        const count = BD_STORE.getCartCount();
        const badge = $('cart-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = String(count);
            badge.hidden = false;
            badge.setAttribute('aria-hidden', 'false');
        } else {
            badge.textContent = '';
            badge.hidden = true;
            badge.setAttribute('aria-hidden', 'true');
        }
    }

    function checkoutUrl(slug) {
        return (typeof bdStripeUrl === 'function' ? bdStripeUrl(slug) : null) || 'index.html#products';
    }

    function goCheckout(slug) {
        if (typeof bdGoStripe === 'function' && bdGoStripe(slug)) return;
        window.location.href = checkoutUrl(slug);
    }

    function openBuyModal(slug) {
        const product = BD_STORE.CATALOG[slug];
        if (!product) return;
        const modal = $('buy-modal');
        if (!modal) return;
        $('buy-modal-name').textContent = product.name;
        $('buy-modal-tag').textContent = product.tag;
        $('buy-modal-price').textContent = formatPrice(product.price);
        $('buy-modal-was').textContent = formatPrice(product.was);
        modal.dataset.slug = slug;
        modal.hidden = false;
    }

    function closeBuyModal() {
        const modal = $('buy-modal');
        if (modal) modal.hidden = true;
    }

    function renderCartDrawer() {
        BD_STORE.sanitizeCart();
        const list = $('cart-items');
        const empty = $('cart-empty');
        const footer = $('cart-footer');
        const body = $('cart-body');
        if (!list) return;

        const items = BD_STORE.getCartItems();
        list.innerHTML = '';

        if (!items.length) {
            if (empty) empty.hidden = false;
            if (footer) footer.hidden = true;
            if (body) body.classList.add('is-empty');
            list.hidden = true;
            return;
        }

        if (empty) empty.hidden = true;
        if (footer) footer.hidden = false;
        if (body) body.classList.remove('is-empty');
        list.hidden = false;

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML = `
                <div class="cart-item-info">
                    <strong>${item.name}</strong>
                    <span class="mono">${item.tag}</span>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-qty">
                        <button type="button" data-qty="-1" data-slug="${item.slug}" aria-label="Decrease">−</button>
                        <span class="mono">${item.qty}</span>
                        <button type="button" data-qty="1" data-slug="${item.slug}" aria-label="Increase">+</button>
                    </div>
                    <span class="cart-item-price mono">${formatPrice(item.price * item.qty)}</span>
                    <button type="button" class="cart-remove" data-remove="${item.slug}" aria-label="Remove">×</button>
                </div>
            `;
            list.appendChild(row);
        });

        const subtotal = BD_STORE.getCartSubtotal();
        const discount = BD_STORE.applyDiscountPrice(subtotal, BD_STORE.getActiveDiscount());
        if ($('cart-subtotal')) $('cart-subtotal').textContent = formatPrice(subtotal);
        if ($('cart-discount-row')) {
            $('cart-discount-row').hidden = discount.discount <= 0;
            if ($('cart-discount')) $('cart-discount').textContent = '-' + formatPrice(discount.discount);
            if ($('cart-discount-label')) $('cart-discount-label').textContent = discount.code + ' (' + discount.percent + '% off)';
        }
        if ($('cart-total')) $('cart-total').textContent = formatPrice(discount.final);

        list.querySelectorAll('[data-qty]').forEach(btn => {
            btn.addEventListener('click', () => {
                const slug = btn.dataset.slug;
                const item = BD_STORE.getCart().find(i => i.slug === slug);
                if (!item) return;
                BD_STORE.updateCartQty(slug, item.qty + parseInt(btn.dataset.qty, 10));
                renderCartDrawer();
                updateBadge();
            });
        });

        list.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                BD_STORE.removeFromCart(btn.dataset.remove);
                renderCartDrawer();
                updateBadge();
                showToast('Removed from cart');
            });
        });
    }

    function openCart() {
        renderCartDrawer();
        const drawer = $('cart-drawer');
        const overlay = $('cart-overlay');
        if (drawer) {
            drawer.hidden = false;
            drawer.setAttribute('aria-hidden', 'false');
        }
        if (overlay) overlay.hidden = false;
        document.body.classList.add('cart-open');
    }

    function closeCart() {
        const drawer = $('cart-drawer');
        const overlay = $('cart-overlay');
        if (drawer) {
            drawer.hidden = true;
            drawer.setAttribute('aria-hidden', 'true');
        }
        if (overlay) overlay.hidden = true;
        document.body.classList.remove('cart-open');
    }

    $('cart-btn')?.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openCart();
    });

    $('cart-shop-btn')?.addEventListener('click', closeCart);
    $('cart-close')?.addEventListener('click', closeCart);
    $('cart-overlay')?.addEventListener('click', closeCart);

    $('buy-now-btn')?.addEventListener('click', () => {
        const slug = $('buy-modal')?.dataset.slug;
        if (!slug) return;
        closeBuyModal();
        goCheckout(slug);
    });

    $('add-cart-btn')?.addEventListener('click', () => {
        const slug = $('buy-modal')?.dataset.slug;
        if (!slug) return;
        BD_STORE.addToCart(slug);
        updateBadge();
        closeBuyModal();
        showToast('Added to cart — ' + BD_STORE.CATALOG[slug].name);
        openCart();
    });

    $('buy-modal-close')?.addEventListener('click', closeBuyModal);
    $('cart-checkout-btn')?.addEventListener('click', () => {
        const items = BD_STORE.getCartItems();
        if (!items.length) return;
        if (items.length > 1) {
            showToast('Use Get Now per product — Stripe checkout is one item at a time.');
            return;
        }
        goCheckout(items[0].slug);
    });

    document.querySelectorAll('.btn-get[data-slug]').forEach(btn => {
        btn.addEventListener('click', e => {
            if (typeof bdGoStripe === 'function' && bdGoStripe(btn.dataset.slug)) {
                e.preventDefault();
            }
        });
    });

    document.querySelectorAll('[data-buy-slug]').forEach(el => {
        el.addEventListener('click', e => {
            if (typeof bdGoStripe === 'function' && bdGoStripe(el.dataset.buySlug)) {
                e.preventDefault();
            }
        });
    });

    if (typeof bdSyncStripeLinks === 'function') bdSyncStripeLinks();

    window.addEventListener('storage', e => {
        if (e.key === 'bd-cart') {
            updateBadge();
            if (document.body.classList.contains('cart-open')) renderCartDrawer();
        }
    });

    BD_STORE.sanitizeCart();
    if (BD_STORE.getCartCount() > 0 && BD_STORE.getCartItems().length === 0) {
        BD_STORE.clearCart();
    }
    updateBadge();
    window.BD_CART = { openCart, closeCart, openBuyModal, updateBadge, showToast, renderCartDrawer };
})();
