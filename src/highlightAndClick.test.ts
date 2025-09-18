import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import highlightAndClick from './highlightAndClick';

// Mock the dependencies
vi.mock('./utils', () => ({
  default: vi.fn()
}));

vi.mock('./open', () => ({
  default: vi.fn()
}));

import isEmbedded from './utils';
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
  const mockElement = {
    style: {
      border: '',
      cursor: '',
      transition: ''
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any;
  
  const cleanup = highlightAndClick('test-uid', mockElement);
  
  // Verify event listeners were added
  expect(mockElement.addEventListener).toHaveBeenCalledTimes(3);
  expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
  expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  
  // Test cleanup function
  expect(typeof cleanup).toBe('function');
  cleanup();
  
  expect(mockElement.removeEventListener).toHaveBeenCalledTimes(3);
});