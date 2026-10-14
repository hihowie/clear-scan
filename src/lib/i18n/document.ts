import { locale, messages } from './index'

export function initializeDocumentLanguage() {
  document.documentElement.lang = locale
  document.title = messages.appTitle
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', messages.appDescription)
  document
    .querySelector('link[rel="manifest"]')
    ?.setAttribute('href', `${import.meta.env.BASE_URL}manifest.${locale}.webmanifest`)
}
