import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initializeDocumentLanguage } from './lib/i18n/document'
import { subscribeLocale } from './lib/i18n'

initializeDocumentLanguage()
subscribeLocale(initializeDocumentLanguage)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
