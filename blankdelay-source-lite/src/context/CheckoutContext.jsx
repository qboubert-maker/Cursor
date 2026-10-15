import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CHECKOUT_PRODUCTS } from '../lib/checkoutCatalog'

const CheckoutContext = createContext(null)
const DELIVERY_KEY = 'blank-delay-delivery'

const rememberDelivery = (sessionId, productId) => {
  sessionStorage.setItem(DELIVERY_KEY, JSON.stringify({ sessionId, productId }))
}

export function CheckoutProvider({ children }) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isTheaterOpen, setTheaterOpen] = useState(false)
  const [theaterProductId, setTheaterProductId] = useState(null)
  const [pendingSection, setPendingSection] = useState(null)
  const [sessionId, setSessionId] = useState('')

  const showDelivery = useCallback((product, id) => {
    setSelectedProduct(product)
    setSessionId(id)
    setTheaterOpen(false)
    setIsCheckoutOpen(true)
    rememberDelivery(id, product.id)
  }, [])

  const openCheckout = useCallback(
    async (product) => {
      if (!product?.id || !product?.name || typeof product.price !== 'number' || product.id === 'aim-bundle') {
        return { ok: false, error: 'This product is not for sale yet.' }
      }
      try {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, origin: window.location.origin }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) return { ok: false, error: data.error || 'Stripe could not be opened.' }
        if (data.url) {
          window.location.assign(data.url)
          return { ok: true }
        }
        showDelivery(product, 'preview')
        return { ok: true }
      } catch {
        return { ok: false, error: 'Stripe could not be opened.' }
      }
    },
    [showDelivery],
  )

  const closeCheckout = useCallback(() => {
    setIsCheckoutOpen(false)
    setSessionId('')
    sessionStorage.removeItem(DELIVERY_KEY)
  }, [])

  const openTheater = useCallback((product) => {
    if (product?.id) {
      setSelectedProduct(product)
      setTheaterProductId(product.id)
    }
    setIsCheckoutOpen(false)
    setTheaterOpen(true)
  }, [])

  const closeTheater = useCallback(() => {
    setTheaterOpen(false)
  }, [])

  const watchDemonstration = useCallback((sectionIndex) => {
    setTheaterOpen(false)
    setPendingSection(sectionIndex)
  }, [])

  const clearPendingSection = useCallback(() => {
    setPendingSection(null)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const returned = params.get('checkout') === 'success' ? params.get('session_id') : ''
    let saved = null
    try {
      saved = JSON.parse(sessionStorage.getItem(DELIVERY_KEY) || 'null')
    } catch {
      saved = null
    }

    const restore = (id, productId) => {
      const product = CHECKOUT_PRODUCTS[productId]
      if (!product) return
      setSelectedProduct(product)
      setSessionId(id)
      setIsCheckoutOpen(true)
    }

    if (returned) {
      fetch(`/api/checkout-session?session_id=${encodeURIComponent(returned)}`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok || !data.paid) return
          rememberDelivery(returned, data.productId)
          restore(returned, data.productId)
          window.history.replaceState({}, '', window.location.pathname)
        })
        .catch(() => {})
      return
    }

    if (saved?.sessionId && saved?.productId) restore(saved.sessionId, saved.productId)
  }, [])

  const value = useMemo(
    () => ({
      isCheckoutOpen,
      selectedProduct,
      openCheckout,
      closeCheckout,
      isTheaterOpen,
      theaterProductId,
      setTheaterProductId,
      openTheater,
      closeTheater,
      pendingSection,
      watchDemonstration,
      clearPendingSection,
      sessionId,
    }),
    [
      isCheckoutOpen,
      selectedProduct,
      openCheckout,
      closeCheckout,
      isTheaterOpen,
      theaterProductId,
      openTheater,
      closeTheater,
      pendingSection,
      watchDemonstration,
      clearPendingSection,
      sessionId,
    ],
  )

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>
}

export function useCheckout() {
  const context = useContext(CheckoutContext)
  if (!context) throw new Error('useCheckout must be used within CheckoutProvider')
  return context
}
