import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadUtils() {
  const scope = {
    window: { SFAdmin: {} },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    globalThis: undefined
  };
  scope.window.window = scope.window;
  scope.window.globalThis = scope.window;
  scope.globalThis = scope.window;
  const source = readFileSync(resolve(__dirname, '../js/utils.js'), 'utf8');
  runInNewContext(source, scope);
  return scope.window.SFAdmin.utils;
}

describe('Admin utils', () => {
  let utils;

  beforeEach(() => {
    utils = loadUtils();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deepClone returns independent copy', () => {
    const original = { a: 1, nested: { value: 5 } };
    const copy = utils.deepClone(original);
    expect(copy).toEqual(original);
    copy.nested.value = 99;
    expect(original.nested.value).toBe(5);
  });

  it('withRetry resolves after retrying failures', async () => {
    let attempts = 0;
    const result = await utils.withRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('not yet');
      return 'ok';
    }, { retries: 2 });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('withRetry throws after exceeding retries', async () => {
    let attempts = 0;
    await expect(utils.withRetry(async () => {
      attempts += 1;
      throw new Error('nope');
    }, { retries: 1 })).rejects.toThrow('nope');
    expect(attempts).toBe(2);
  });

  it('debounce delays execution', async () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = utils.debounce(spy, 100);
    debounced();
    vi.advanceTimersByTime(50);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(51);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
