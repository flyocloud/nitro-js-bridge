import { beforeEach, expect, test } from 'vitest';
import { isEmbedded, resolveWindow, getEditorOrigin, rememberEditorOrigin } from './utils';

beforeEach(() => {
  // getEditorOrigin prefers the module-level origin learned from a ping — reset it
  // so each test exercises the heuristics it sets up.
  rememberEditorOrigin(null);
});

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

test('getEditorOrigin returns the Flyo editor when window is undefined', () => {
  const originalWindow = globalThis.window;
  delete (globalThis as any).window;

  expect(getEditorOrigin()).toBe('https://flyo.cloud');

  globalThis.window = originalWindow;
});

test('getEditorOrigin prefers the origin learned from the editor ping', () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { ancestorOrigins: ['https://ancestor.example'] } } as any;

  rememberEditorOrigin('https://konsole.flyo.dev');
  expect(getEditorOrigin()).toBe('https://konsole.flyo.dev');

  rememberEditorOrigin(null);
  expect(getEditorOrigin()).toBe('https://ancestor.example');

  globalThis.window = originalWindow;
});

test('getEditorOrigin prefers ancestorOrigins over the referrer', () => {
  const originalWindow = globalThis.window;
  const originalDocument = (globalThis as any).document;
  globalThis.window = { location: { ancestorOrigins: ['https://flyo.cloud'], origin: 'https://site.example' } } as any;
  (globalThis as any).document = { referrer: 'https://other.example/page' };

  expect(getEditorOrigin()).toBe('https://flyo.cloud');

  globalThis.window = originalWindow;
  (globalThis as any).document = originalDocument;
});

test('getEditorOrigin falls back to a cross-origin referrer', () => {
  const originalWindow = globalThis.window;
  const originalDocument = (globalThis as any).document;
  globalThis.window = { location: { origin: 'https://site.example' } } as any;
  (globalThis as any).document = { referrer: 'https://konsole.flyo.dev/some/path' };

  expect(getEditorOrigin()).toBe('https://konsole.flyo.dev');

  globalThis.window = originalWindow;
  (globalThis as any).document = originalDocument;
});

test('getEditorOrigin skips a same-origin referrer (in-site navigation)', () => {
  const originalWindow = globalThis.window;
  const originalDocument = (globalThis as any).document;
  globalThis.window = { location: { origin: 'https://site.example' } } as any;
  (globalThis as any).document = { referrer: 'https://site.example/previous-page' };

  expect(getEditorOrigin()).toBe('https://flyo.cloud');

  globalThis.window = originalWindow;
  (globalThis as any).document = originalDocument;
});

test('getEditorOrigin defaults to the Flyo editor without ancestorOrigins and referrer', () => {
  const originalWindow = globalThis.window;
  const originalDocument = (globalThis as any).document;
  globalThis.window = { location: {} } as any;
  (globalThis as any).document = { referrer: '' };

  expect(getEditorOrigin()).toBe('https://flyo.cloud');

  globalThis.window = originalWindow;
  (globalThis as any).document = originalDocument;
});

test('getEditorOrigin defaults to the Flyo editor for an invalid referrer', () => {
  const originalWindow = globalThis.window;
  const originalDocument = (globalThis as any).document;
  globalThis.window = { location: {} } as any;
  (globalThis as any).document = { referrer: 'not a url' };

  expect(getEditorOrigin()).toBe('https://flyo.cloud');

  globalThis.window = originalWindow;
  (globalThis as any).document = originalDocument;
});