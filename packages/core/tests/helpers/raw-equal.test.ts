import { describe, expect, it } from 'vitest';
import { expectJsonEqual } from './raw-equal';

describe('expectJsonEqual', () => {
  it('should pass for identical JSON strings', () => {
    const json1 = '{"key":"value"}';
    const json2 = '{"key":"value"}';
    expect(() => expectJsonEqual(json1, json2)).not.toThrow();
  });

  it('should pass for semantically equal JSON with different formatting', () => {
    const json1 = '{"key":"value","nested":{"a":1}}';
    const json2 = '{\n  "key": "value",\n  "nested": {\n    "a": 1\n  }\n}';
    expect(() => expectJsonEqual(json1, json2)).not.toThrow();
  });

  it('should fail for different JSON content', () => {
    const json1 = '{"key":"value1"}';
    const json2 = '{"key":"value2"}';
    expect(() => expectJsonEqual(json1, json2)).toThrow();
  });

  it('should pass for identical non-JSON strings', () => {
    const str1 = 'plain text';
    const str2 = 'plain text';
    expect(() => expectJsonEqual(str1, str2)).not.toThrow();
  });

  it('should fail for different non-JSON strings', () => {
    const str1 = 'text1';
    const str2 = 'text2';
    expect(() => expectJsonEqual(str1, str2)).toThrow();
  });

  it('should handle mixed JSON and non-JSON (treat as strings)', () => {
    const json = '{"key":"value"}';
    const text = 'not json';
    expect(() => expectJsonEqual(json, text)).toThrow();
  });
});
