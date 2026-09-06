import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
});
Object.defineProperty(globalThis, 'window', {
  value: dom.window,
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: dom.window.document,
  configurable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
for (const key of [
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLDivElement',
  'Element',
  'Document',
  'SVGElement',
  'Node',
  'NodeFilter',
  'Event',
  'MouseEvent',
  'FocusEvent',
  'KeyboardEvent',
  'MutationObserver',
  'DOMRect',
  'ShadowRoot',
])
  Object.defineProperty(globalThis, key, {
    value: (dom.window as unknown as Record<string, unknown>)[key],
    configurable: true,
  });
Object.defineProperty(globalThis, 'getComputedStyle', {
  value: dom.window.getComputedStyle.bind(dom.window),
  configurable: true,
});
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: dom.window.requestAnimationFrame.bind(dom.window),
  configurable: true,
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: dom.window.cancelAnimationFrame.bind(dom.window),
  configurable: true,
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverStub,
  configurable: true,
});
Object.defineProperty(dom.window, 'ResizeObserver', {
  value: ResizeObserverStub,
  configurable: true,
});
Object.defineProperty(globalThis, 'PointerEvent', {
  value: dom.window.MouseEvent,
  configurable: true,
});
Object.defineProperty(dom.window, 'PointerEvent', {
  value: dom.window.MouseEvent,
  configurable: true,
});
Object.defineProperty(dom.window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});
Object.defineProperty(dom.window.HTMLElement.prototype, 'hasPointerCapture', {
  value: () => false,
});
Object.defineProperty(dom.window.HTMLElement.prototype, 'setPointerCapture', {
  value: () => {},
});
Object.defineProperty(
  dom.window.HTMLElement.prototype,
  'releasePointerCapture',
  { value: () => {} },
);
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  value: true,
  configurable: true,
  writable: true,
});
