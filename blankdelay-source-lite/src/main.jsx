import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
const path = window.location.pathname
const affiliate = path === '/affiliates' || path.startsWith('/affiliates/')

if (affiliate) {
  const [{ default: AffiliateApp }] = await Promise.all([
    import('./components/affiliate/AffiliateApp.jsx'),
    import('./index.css'),
  ])
  createRoot(root).render(
    <StrictMode>
      <AffiliateApp />
    </StrictMode>,
  )
} else {
  const [{ default: App }, { default: Delivery }, { default: ProductTheater }, { CheckoutProvider }] = await Promise.all([
    import('./App.jsx'),
    import('./components/Delivery.jsx'),
    import('./components/ProductTheater.jsx'),
    import('./context/CheckoutContext.jsx'),
    import('lenis/dist/lenis.css'),
    import('./index.css'),
  ])

  createRoot(root).render(
    <StrictMode>
      <CheckoutProvider>
        <App />
        <Delivery />
        <ProductTheater />
      </CheckoutProvider>
    </StrictMode>,
  )
}
