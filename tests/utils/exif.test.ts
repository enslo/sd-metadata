import { describe, expect, it } from 'vitest';
import { decodeUserComment } from '../../src/utils/exif';

describe('decodeUserComment', () => {
  it('should decode UNICODE prefixed data', () => {
    // "UNICODE\0" followed by UTF-16BE "hello"
    const unicodePrefix = new Uint8Array([
      0x55, 0x4e, 0x49, 0x43, 0x4f, 0x44, 0x45, 0x00,
    ]);
    // "hello" in UTF-16BE
    const utf16be = new Uint8Array([
      0x00, 0x68, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f,
    ]);
    const data = new Uint8Array([...unicodePrefix, ...utf16be]);
    const result = decodeUserComment(data);
    expect(result).toBe('hello');
  });

  it('should decode ASCII prefixed data', () => {
    // "ASCII\0\0\0" followed by "hello"
    const asciiPrefix = new Uint8Array([
      0x41, 0x53, 0x43, 0x49, 0x49, 0x00, 0x00, 0x00,
    ]);
    const text = new TextEncoder().encode('hello');
    const data = new Uint8Array([...asciiPrefix, ...text]);
    const result = decodeUserComment(data);
    expect(result).toBe('hello');
  });

  it('should decode UTF-8 JSON without prefix', () => {
    // ComfyUI stores JSON directly without prefix
    const json = '{"prompt": {}}';
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const result = decodeUserComment(data);
    expect(result).toBe(json);
  });
});
