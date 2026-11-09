import { describe, expect, it } from 'vitest';
import { trimTrailingBlanks, trimTrailingNul } from '../../../src/utils/text';

describe('trimTrailingNul', () => {
  it('removes NUL characters at the end only', () => {
    expect(trimTrailingNul('abc\0\0')).toBe('abc');
    expect(trimTrailingNul('a\0b\0')).toBe('a\0b');
    expect(trimTrailingNul('abc')).toBe('abc');
    expect(trimTrailingNul('\0\0')).toBe('');
    expect(trimTrailingNul('')).toBe('');
  });

  it('runs in linear time on a long run of NULs followed by text', () => {
    // `/\0+$/` was retried from every NUL and took seconds here
    const text = `{"a":1}${'\0'.repeat(200_000)}x`;
    expect(trimTrailingNul(text)).toBe(text);
  });
});

describe('trimTrailingBlanks', () => {
  it('removes spaces and tabs at the end, keeping other whitespace', () => {
    expect(trimTrailingBlanks('abc \t ')).toBe('abc');
    expect(trimTrailingBlanks(' abc')).toBe(' abc');
    expect(trimTrailingBlanks('abc\n')).toBe('abc\n');
    expect(trimTrailingBlanks('')).toBe('');
  });
});
