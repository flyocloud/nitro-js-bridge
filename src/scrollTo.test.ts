import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import scrollTo from './scrollTo';

// Mock the dependencies
vi.mock('./utils', () => ({
  isEmbedded: vi.fn()
}));

import { isEmbedded } from './utils';

const mockIsEmbedded = vi.mocked(isEmbedded);

beforeEach(() => {
  vi.clearAllMocks();
  // CSS.escape is a browser-only API; provide a simple identity mock for the test environment
  (globalThis as any).CSS = { escape: (s: string) => s };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).CSS;
});

test('scrollTo does nothing when window is undefined', () => {
  const originalWindow = (globalThis as any).window;
  delete (globalThis as any).window;

  // Should not throw
  expect(() => scrollTo()).not.toThrow();

  (globalThis as any).window = originalWindow;
});

test('scrollTo does not register listener when not embedded', () => {
  mockIsEmbedded.mockReturnValue(false);

  const mockWin = { addEventListener: vi.fn() };
  (globalThis as any).window = mockWin;

  scrollTo();

  expect(mockWin.addEventListener).not.toHaveBeenCalled();

  delete (globalThis as any).window;
});

test('scrollTo registers message listener when embedded', () => {
  mockIsEmbedded.mockReturnValue(true);

  const mockWin = { addEventListener: vi.fn() };
  (globalThis as any).window = mockWin;

  scrollTo();

  expect(mockWin.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

  delete (globalThis as any).window;
});

test('scrollTo scrolls to element when correct message is received', () => {
  mockIsEmbedded.mockReturnValue(true);

  const mockElement = { scrollIntoView: vi.fn() };
  const mockDoc = { querySelector: vi.fn().mockReturnValue(mockElement) };

  let messageHandler: ((event: any) => void) | undefined;
  const mockWin = {
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'message') messageHandler = handler;
    })
  };
  (globalThis as any).window = mockWin;
  (globalThis as any).document = mockDoc;

  scrollTo();

  // Simulate the message from the preview iframe
  messageHandler!({
    data: {
      action: 'scrollTo',
      data: { item: { uid: 'block-123' } }
    }
  });

  expect(mockDoc.querySelector).toHaveBeenCalledWith('[data-flyo-uid="block-123"]');
  expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

test('scrollTo does nothing when message action is not scrollTo', () => {
  mockIsEmbedded.mockReturnValue(true);

  const mockDoc = { querySelector: vi.fn() };
  let messageHandler: ((event: any) => void) | undefined;
  const mockWin = {
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'message') messageHandler = handler;
    })
  };
  (globalThis as any).window = mockWin;
  (globalThis as any).document = mockDoc;

  scrollTo();

  messageHandler!({ data: { action: 'pageRefresh' } });

  expect(mockDoc.querySelector).not.toHaveBeenCalled();

  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

test('scrollTo does nothing when uid is missing from message', () => {
  mockIsEmbedded.mockReturnValue(true);

  const mockDoc = { querySelector: vi.fn() };
  let messageHandler: ((event: any) => void) | undefined;
  const mockWin = {
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'message') messageHandler = handler;
    })
  };
  (globalThis as any).window = mockWin;
  (globalThis as any).document = mockDoc;

  scrollTo();

  messageHandler!({ data: { action: 'scrollTo', data: { item: {} } } });

  expect(mockDoc.querySelector).not.toHaveBeenCalled();

  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

test('scrollTo does nothing when element is not found', () => {
  mockIsEmbedded.mockReturnValue(true);

  const mockDoc = { querySelector: vi.fn().mockReturnValue(null) };
  let messageHandler: ((event: any) => void) | undefined;
  const mockWin = {
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'message') messageHandler = handler;
    })
  };
  (globalThis as any).window = mockWin;
  (globalThis as any).document = mockDoc;

  scrollTo();

  // Should not throw when element is not found
  expect(() => messageHandler!({
    data: { action: 'scrollTo', data: { item: { uid: 'nonexistent' } } }
  })).not.toThrow();

  delete (globalThis as any).window;
  delete (globalThis as any).document;
});
