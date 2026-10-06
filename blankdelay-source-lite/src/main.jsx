import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'lenis/dist/lenis.css'
import './index.css'
import App from './App.jsx'
import Delivery from './components/Delivery.jsx'
import ProductTheater from './components/ProductTheater.jsx'
import { CheckoutProvider } from './context/CheckoutContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CheckoutProvider>
      <App />
      <Delivery />
      <ProductTheater />
    </CheckoutProvider>
  </StrictMode>,
)
