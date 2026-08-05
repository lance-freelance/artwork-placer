import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// jsdom doesn't implement pointer capture APIs — stub them so the hook's
// capture bookkeeping runs without throwing.
const capturedPointers = new Set<number>();

HTMLElement.prototype.setPointerCapture = function (pointerId: number) {
  capturedPointers.add(pointerId);
};
HTMLElement.prototype.releasePointerCapture = function (pointerId: number) {
  capturedPointers.delete(pointerId);
};
HTMLElement.prototype.hasPointerCapture = function (pointerId: number) {
  return capturedPointers.has(pointerId);
};

// Clean up between tests so capture state doesn't leak.
afterEach(() => {
  capturedPointers.clear();
});
