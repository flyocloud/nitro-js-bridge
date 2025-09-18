import { expect, test } from 'vitest';
import { isEmbedded, resolveWindow } from './utils';

// Mock window object for testing
const mockWindow = (isTop: boolean) => {
  const windowObj = {
    top: isTop ? undefined : {},
  } as any;
  
  if (isTop) {
    windowObj.top = windowObj;
  }
  
  return windowObj;
};

test('isEmbedded returns false when window is undefined', () => {
  // Mock undefined window (server-side rendering scenario)
  const originalWindow = globalThis.window;
  delete (globalThis as any).window;
  
  const result = isEmbedded();
  expect(result).toBe(false);
  
  // Restore window
  globalThis.window = originalWindow;
});

test('resolveWindow returns false when window is undefined', () => {
  const originalWindow = globalThis.window;
  delete (globalThis as any).window;

  const result = resolveWindow();
  expect(result).toBe(false);

  globalThis.window = originalWindow;
});

test('isEmbedded returns false when window is top window', () => {
  const originalWindow = globalThis.window;
  globalThis.window = mockWindow(true);
  
  const result = isEmbedded();
  expect(result).toBe(false);
  
  globalThis.window = originalWindow;
});

test('isEmbedded returns true when window is not top window (iframe)', () => {
  const originalWindow = globalThis.window;
  globalThis.window = mockWindow(false);
  
  const result = isEmbedded();
  expect(result).toBe(true);
  
  globalThis.window = originalWindow;
});

test('resolveWindow returns window when top window', () => {
  const originalWindow = globalThis.window;
  const w = mockWindow(true);
  globalThis.window = w;

  const result = resolveWindow();
  expect(result).toBe(w);

  globalThis.window = originalWindow;
});

test('resolveWindow returns parent when in iframe', () => {
  const originalWindow = globalThis.window;
  const w = mockWindow(false);
  // In our mock, w.top is a different object, so parent should be accessible via w.parent
  // We'll set parent to a distinct object to assert it's returned.
  const parent = { sentinel: true } as any;
  w.parent = parent;
  globalThis.window = w;

  const result = resolveWindow();
  expect(result).toBe(parent);

  globalThis.window = originalWindow;
});