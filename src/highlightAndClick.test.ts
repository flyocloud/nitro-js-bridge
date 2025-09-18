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
  const mockOverlay: any = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerHTML: '',
    parentElement: mockElement,
    setAttribute: vi.fn(),
    style: {},
    type: ''
  };

  const originalDocument = (global as any).document;
  const originalGetComputedStyle = (global as any).getComputedStyle;
  (global as any).document = {
    createElement: vi.fn(() => mockOverlay)
  } as any;
  (global as any).getComputedStyle = vi.fn(() => ({ position: 'static' })) as any;

  const cleanup = highlightAndClick('test-uid', mockElement);

  // Verify hover event listeners were added (mouseenter, mouseleave)
  expect(mockElement.addEventListener).toHaveBeenCalledTimes(2);
  expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
  expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));

  // Verify overlay was appended
  expect(mockElement.appendChild).toHaveBeenCalledTimes(1);

  // Test cleanup function
  expect(typeof cleanup).toBe('function');
  cleanup();

  // Verify hover listeners removed and overlay removed
  expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
  expect(mockElement.removeChild).toHaveBeenCalledTimes(1);

  // Restore globals
  (global as any).document = originalDocument;
  (global as any).getComputedStyle = originalGetComputedStyle;
});