import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './vanilla/vanilla.css'
import App from './App.jsx'
import { ToastProvider } from './components/ui'
import { AuthProvider } from './context/AuthContext'
import { HealthProvider } from './context/HealthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <HealthProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </HealthProvider>
    </BrowserRouter>
  </StrictMode>,
)
