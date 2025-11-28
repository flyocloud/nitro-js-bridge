import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import highlightAndClick from './highlightAndClick';

// Mock the dependencies
vi.mock('./utils', () => ({
  isEmbedded: vi.fn()
}));

vi.mock('./open', () => ({
  default: vi.fn()
}));

import { isEmbedded } from './utils';
import open from './open';

const mockIsEmbedded = vi.mocked(isEmbedded);
const mockOpen = vi.mocked(open);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('highlightAndClick returns open handler when not embedded', () => {
  mockIsEmbedded.mockReturnValue(false);
  
  const result = highlightAndClick('test-uid');
  expect(typeof result).toBe('function');
  
  // Call the returned function
  result();
  expect(mockOpen).toHaveBeenCalledWith('test-uid');
});

test('highlightAndClick returns open handler when no element provided', () => {
  mockIsEmbedded.mockReturnValue(true);
  
  const result = highlightAndClick('test-uid');
  expect(typeof result).toBe('function');
  
  result();
  expect(mockOpen).toHaveBeenCalledWith('test-uid');
});

test('highlightAndClick sets up hover effects when embedded and element provided', () => {
  mockIsEmbedded.mockReturnValue(true);

  // Mock DOM element
  const mockElement: any = {
    style: {
      border: '',
      cursor: '',
      transition: '',
      position: ''
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn()
  };

  // Mock the DOM APIs used by the function: document.createElement and getComputedStyle
  const makeMockOverlay = () => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerHTML: '',
    parentElement: null,
    setAttribute: vi.fn(),
    style: {},
    type: ''
  });

  const originalDocument = (global as any).document;
  const originalGetComputedStyle = (global as any).getComputedStyle;
  const originalWindow = (global as any).window;
  const originalRAF = (global as any).requestAnimationFrame;
  const originalCAF = (global as any).cancelAnimationFrame;
  const mockBody: any = {
    appendChild: vi.fn((o: any) => { o.parentElement = mockBody; }),
    removeChild: vi.fn((o: any) => { o.parentElement = null; })
  };
  const created: any[] = [];
  const mockDoc: any = {
    createElement: vi.fn((tag?: string) => {
      const o = makeMockOverlay();
      // Track tag name and set type for buttons
      (o as any).tagName = tag?.toUpperCase() || '';
      if (tag === 'button') o.type = 'button';
      created.push(o);
      return o;
    }),
    body: mockBody,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any;
  // spy on document.removeEventListener for later assertion
  (mockDoc as any).removeEventListener = vi.fn();
  (global as any).document = mockDoc;
  (global as any).getComputedStyle = vi.fn(() => ({ position: 'static' })) as any;
  // Mock window and RAF/CARF for Node test environment
  (global as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerWidth: 1024,
    innerHeight: 768,
    ResizeObserver: undefined
  } as any;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0) as any;
  (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id as any) as any;

  const cleanup = highlightAndClick('test-uid', mockElement);

  // Verify hover event listeners were added (mouseenter, mouseleave)
  expect(mockElement.addEventListener).toHaveBeenCalledTimes(2);
  expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
  expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));

  // Verify overlays (pad + button) were appended to document.body
  expect((global as any).document.createElement).toHaveBeenCalledTimes(2);
  expect((global as any).document.body.appendChild).toHaveBeenCalledTimes(2);

  // Test cleanup function
  expect(typeof cleanup).toBe('function');
  cleanup();

  // Verify hover listeners removed and overlay removed from body
  expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
  expect((global as any).document.body.removeChild).toHaveBeenCalledTimes(2);

  // Verify the pad element (the div element, not button) has pointer-events: none
  // to allow clicks to pass through to the original element
  const padElement = created.find((el: any) => el.tagName === 'DIV');
  expect(padElement).toBeDefined();
  expect(padElement.style.pointerEvents).toBe('none');

  // Restore globals
  (global as any).document = originalDocument;
  (global as any).getComputedStyle = originalGetComputedStyle;
  (global as any).window = originalWindow;
  (global as any).requestAnimationFrame = originalRAF;
  (global as any).cancelAnimationFrame = originalCAF;
});