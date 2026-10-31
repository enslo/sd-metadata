import { describe, expect, it } from 'vitest';
import type { PngTextChunk, RawMetadata } from '../../src/types';
import { expectJsonEqual, expectRawEqual } from './raw-equal';

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

describe('expectRawEqual', () => {
  const text = (keyword: string, value: string): PngTextChunk => ({
    type: 'tEXt',
    keyword,
    text: value,
  });
  const itxt = (
    keyword: string,
    value: string,
  ): Extract<PngTextChunk, { type: 'iTXt' }> => ({
    type: 'iTXt',
    keyword,
    compressionFlag: 0,
    compressionMethod: 0,
    languageTag: '',
    translatedKeyword: '',
    text: value,
  });
  const png = (...chunks: PngTextChunk[]): RawMetadata => ({
    format: 'png',
    chunks,
  });

  it('should pass for identical chunk lists', () => {
    expect(() =>
      expectRawEqual(
        png(text('a', 'x'), itxt('b', 'テスト')),
        png(text('a', 'x'), itxt('b', 'テスト')),
      ),
    ).not.toThrow();
  });

  it('should fail when a chunk type differs', () => {
    expect(() =>
      expectRawEqual(png(itxt('a', 'テスト')), png(text('a', 'テスト'))),
    ).toThrow();
  });

  describe('allowItxtUpgrade', () => {
    const upgrade = { allowItxtUpgrade: true };

    it('should tolerate a non-Latin-1 tEXt chunk coming back as iTXt', () => {
      expect(() =>
        expectRawEqual(
          png(itxt('parameters', 'テスト')),
          png(text('parameters', 'テスト')),
          upgrade,
        ),
      ).not.toThrow();
    });

    it('should tolerate escaped JSON tEXt coming back as raw Unicode iTXt', () => {
      // Pre-2.16 Stability Matrix: \u-escaped ASCII JSON in tEXt
      expect(() =>
        expectRawEqual(
          png(itxt('parameters-json', '{"PositivePrompt":"テスト"}')),
          png(
            text(
              'parameters-json',
              '{"PositivePrompt":"\\u30C6\\u30B9\\u30C8"}',
            ),
          ),
          upgrade,
        ),
      ).not.toThrow();
    });

    it('should still compare keyword and text across the upgrade', () => {
      expect(() =>
        expectRawEqual(
          png(itxt('other', 'テスト')),
          png(text('parameters', 'テスト')),
          upgrade,
        ),
      ).toThrow();
      expect(() =>
        expectRawEqual(
          png(itxt('parameters', 'テスト 2')),
          png(text('parameters', 'テスト')),
          upgrade,
        ),
      ).toThrow();
    });

    it('should not tolerate the upgrade for Latin-1 text', () => {
      expect(() =>
        expectRawEqual(
          png(itxt('a', 'plain')),
          png(text('a', 'plain')),
          upgrade,
        ),
      ).toThrow();
    });

    it('should not tolerate a downgrade to tEXt', () => {
      expect(() =>
        expectRawEqual(
          png(text('a', 'テスト')),
          png(itxt('a', 'テスト')),
          upgrade,
        ),
      ).toThrow();
    });

    it('should require the uncompressed, untagged iTXt form', () => {
      const tagged: PngTextChunk = {
        ...itxt('a', 'テスト'),
        languageTag: 'ja',
      };
      expect(() =>
        expectRawEqual(png(tagged), png(text('a', 'テスト')), upgrade),
      ).toThrow();
    });
  });
});
