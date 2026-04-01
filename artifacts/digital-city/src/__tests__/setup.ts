/**
 * Global test setup for digital-city (jsdom environment)
 */
import "@testing-library/jest-dom";

// Provide a minimal localStorage mock that survives across tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear:      () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key:        (i: number) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

// Reset storage before every test so tests are isolated
beforeEach(() => localStorageMock.clear());
