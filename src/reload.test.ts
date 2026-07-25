import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import reload from './reload';

// Mock the dependencies
vi.mock('./utils', () => ({
  isEmbedded: vi.fn()
}));

vi.mock('./editorConnection', () => ({
  registerEditorHandshake: vi.fn()
}));

import { isEmbedded } from './utils';
import { registerEditorHandshake } from './editorConnection';

const mockIsEmbedded = vi.mocked(isEmbedded);
const mockRegisterEditorHandshake = vi.mocked(registerEditorHandshake);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).window;
});

const mockEmbeddedWindow = () => {
  let messageHandler: ((event: any) => void) | undefined;
  const mockWin = {
    addEventListener: vi.fn((type: string, handler: any) => {
      if (type === 'message') messageHandler = handler;
    }),
    location: { reload: vi.fn() }
  };
  (globalThis as any).window = mockWin;
  return { mockWin, getMessageHandler: () => messageHandler };
};

test('reload does nothing when window is undefined', () => {
  delete (globalThis as any).window;

  expect(() => reload()).not.toThrow();
  expect(mockRegisterEditorHandshake).not.toHaveBeenCalled();
});

test('reload does not register listener or handshake when not embedded', () => {
  mockIsEmbedded.mockReturnValue(false);

  const { mockWin } = mockEmbeddedWindow();

  reload();

  expect(mockWin.addEventListener).not.toHaveBeenCalled();
  expect(mockRegisterEditorHandshake).not.toHaveBeenCalled();
});

test('reload registers message listener and the editor handshake when embedded', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin } = mockEmbeddedWindow();

  reload();

  expect(mockWin.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  expect(mockRegisterEditorHandshake).toHaveBeenCalledTimes(1);
});

test('reload reloads the page when pageRefresh message is received', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin, getMessageHandler } = mockEmbeddedWindow();

  reload();

  getMessageHandler()!({ data: { action: 'pageRefresh' } });

  expect(mockWin.location.reload).toHaveBeenCalled();
});

test('reload ignores unrelated messages', () => {
  mockIsEmbedded.mockReturnValue(true);

  const { mockWin, getMessageHandler } = mockEmbeddedWindow();

  reload();

  getMessageHandler()!({ data: { action: 'somethingElse' } });
  getMessageHandler()!({ data: null });

  expect(mockWin.location.reload).not.toHaveBeenCalled();
});
