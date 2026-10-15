import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ConsoleDashboard from './components/ConsoleDashboard.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConsoleDashboard />
  </StrictMode>,
)
