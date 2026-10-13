import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BlankDelayCommercial from './components/BlankDelayCommercial.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BlankDelayCommercial />
  </StrictMode>,
)
