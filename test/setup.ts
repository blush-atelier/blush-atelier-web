import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';
Object.assign(globalThis, { TextEncoder, TextDecoder });
Object.defineProperty(window, 'scrollTo', { value: jest.fn(), writable: true });
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true,
});
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};

class TestPointerEvent extends MouseEvent {
  readonly pointerType: string;
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? 'mouse';
    this.pointerId = init.pointerId ?? 1;
  }
}
Object.defineProperty(window, 'PointerEvent', {
  value: TestPointerEvent,
  writable: true,
});
Object.assign(HTMLElement.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
