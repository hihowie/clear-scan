import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// Use jsdom's browser storage instead of Node's process-wide localStorage.
const { jsdom } = globalThis as typeof globalThis & { jsdom: { window: Window } }
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => jsdom.window.localStorage,
})

Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['zh-CN'] })
Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'zh-CN' })

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock
