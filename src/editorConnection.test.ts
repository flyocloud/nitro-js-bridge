import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { registerEditorHandshake } from './editorConnection';

// Mock the dependencies
vi.mock('./utils', () => ({
  isEmbedded: vi.fn(),
  getEditorOrigin: vi.fn(),
  rememberEditorOrigin: vi.fn()
}));

import { isEmbedded, getEditorOrigin, rememberEditorOrigin } from './utils';

const mockIsEmbedded = vi.mocked(isEmbedded);
const mockGetEditorOrigin = vi.mocked(getEditorOrigin);
const mockRememberEditorOrigin = vi.mocked(rememberEditorOrigin);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEditorOrigin.mockReturnValue('https://flyo.cloud');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).window;
});

// The once-per-document guard lives on the window object, so a fresh mock
// window per test also resets the registration state.
const mockEmbeddedWindow = () => {
  const handlers: Array<(event: any) => void> = [];
  const mockWin = {
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'message') handlers.push(handler);
    }),
    parent: { postMessage: vi.fn() }
  };
  (globalThis as any).window = mockWin;
  return { mockWin, dispatch: (event: any) => handlers.forEach((h) => h(event)) };
};

test('registerEditorHandshake does nothing when window is undefined', () => {
  delete (globalThis as any).window;

  expect(() => registerEditorHandshake()).not.toThrow();
});

test('registerEditorHandshake does nothing when not embedded', () => {
  mockIsEmbedded.mockReturnValue(false);

  const { mockWin } = mockEmbeddedWindow();

  registerEditorHandshake();

  expect(mockWin.addEventListener).not.toHaveBeenCalled();
  expect(mockWin.parent.postMessage).not.toHaveBeenCalled();
});

test('registerEditorHandshake announces liveEditReady to the parent when embedded', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin } = mockEmbeddedWindow();

  registerEditorHandshake();

  expect(mockWin.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  expect(mockWin.parent.postMessage).toHaveBeenCalledWith(
    { action: 'liveEditReady' },
    'https://flyo.cloud'
  );
});

test('registerEditorHandshake runs at most once per document', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin } = mockEmbeddedWindow();

  registerEditorHandshake();
  registerEditorHandshake();
  registerEditorHandshake();

  expect(mockWin.addEventListener).toHaveBeenCalledTimes(1);
  expect(mockWin.parent.postMessage).toHaveBeenCalledTimes(1);
});

test('registerEditorHandshake replies to a liveEditPing from the parent and learns its origin', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin, dispatch } = mockEmbeddedWindow();

  registerEditorHandshake();
  mockWin.parent.postMessage.mockClear(); // drop the boot announcement call

  dispatch({
    data: { action: 'liveEditPing' },
    source: mockWin.parent,
    origin: 'https://konsole.flyo.dev'
  });

  expect(mockRememberEditorOrigin).toHaveBeenCalledWith('https://konsole.flyo.dev');
  expect(mockWin.parent.postMessage).toHaveBeenCalledWith(
    { action: 'liveEditReady' },
    'https://konsole.flyo.dev'
  );
});

test('registerEditorHandshake replies with wildcard origin when the event origin is empty', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin, dispatch } = mockEmbeddedWindow();

  registerEditorHandshake();
  mockWin.parent.postMessage.mockClear();

  dispatch({
    data: { action: 'liveEditPing' },
    source: mockWin.parent,
    origin: ''
  });

  expect(mockRememberEditorOrigin).toHaveBeenCalledWith(null);
  expect(mockWin.parent.postMessage).toHaveBeenCalledWith(
    { action: 'liveEditReady' },
    '*'
  );
});

test('registerEditorHandshake ignores liveEditPing messages that are not from the parent window', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin, dispatch } = mockEmbeddedWindow();

  registerEditorHandshake();
  mockWin.parent.postMessage.mockClear();

  const stranger = { postMessage: vi.fn() };
  dispatch({
    data: { action: 'liveEditPing' },
    source: stranger,
    origin: 'https://evil.example'
  });

  expect(mockRememberEditorOrigin).not.toHaveBeenCalled();
  expect(stranger.postMessage).not.toHaveBeenCalled();
  expect(mockWin.parent.postMessage).not.toHaveBeenCalled();
});

test('registerEditorHandshake ignores unrelated messages', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin, dispatch } = mockEmbeddedWindow();

  registerEditorHandshake();
  mockWin.parent.postMessage.mockClear();

  dispatch({ data: { action: 'somethingElse' }, source: mockWin.parent, origin: 'https://evil.example' });
  dispatch({ data: null, source: mockWin.parent, origin: 'https://evil.example' });

  expect(mockRememberEditorOrigin).not.toHaveBeenCalled();
  expect(mockWin.parent.postMessage).not.toHaveBeenCalled();
});
