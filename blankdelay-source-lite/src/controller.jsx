import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ControllerMacroApp from './components/ControllerMacroApp.jsx'
import Delivery from './components/Delivery.jsx'
import ProductTheater from './components/ProductTheater.jsx'
import { CheckoutProvider } from './context/CheckoutContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CheckoutProvider>
      <ControllerMacroApp />
      <Delivery />
      <ProductTheater />
    </CheckoutProvider>
  </StrictMode>,
)
