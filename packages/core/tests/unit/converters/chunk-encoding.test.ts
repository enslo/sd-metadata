import { describe, expect, it } from 'vitest';
import {
  type ChunkEncodingStrategy,
  createEncodedChunk,
  escapeUnicode,
} from '../../../src/converters/chunk-encoding';

describe('escapeUnicode', () => {
  it('should escape Japanese characters', () => {
    expect(escapeUnicode('テスト')).toBe('\\u30c6\\u30b9\\u30c8');
  });

  it('should not escape ASCII characters', () => {
    expect(escapeUnicode('test')).toBe('test');
  });

  it('should handle mixed content', () => {
    expect(escapeUnicode('hello テスト world')).toBe(
      'hello \\u30c6\\u30b9\\u30c8 world',
    );
  });

  it('should handle special characters', () => {
    // Latin-1 extended (é = U+00E9) and the emoji (🎉 = U+1F389) are escaped
    expect(escapeUnicode('émoji 🎉')).toBe('\\u00e9moji \\ud83c\\udf89');
  });

  it('should escape Latin-1 extended characters too', () => {
    // A PIL-based reader decodes tEXt as Latin-1, so U+0080-U+00FF written
    // as UTF-8 would come out as mojibake; the JSON value is unchanged
    expect(escapeUnicode('café')).toBe('caf\\u00e9');
    expect(escapeUnicode('niño')).toBe('ni\\u00f1o');
  });

  it('should handle empty string', () => {
    expect(escapeUnicode('')).toBe('');
  });
});

describe('createEncodedChunk', () => {
  describe('dynamic strategy', () => {
    it('should use tEXt for ASCII-only content', () => {
      const chunks = createEncodedChunk('test', 'hello world', 'dynamic');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.keyword).toBe('test');
      expect(chunks[0]?.text).toBe('hello world');
    });

    it('should use tEXt for Latin-1 extended content', () => {
      const chunks = createEncodedChunk('test', 'café', 'dynamic');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.text).toBe('café');
      expect(chunks[0]).toMatchObject({ encoding: 'latin1' });
    });

    it('should use iTXt for non-Latin-1 content', () => {
      const chunks = createEncodedChunk('test', 'テスト', 'dynamic');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('iTXt');
      expect(chunks[0]?.keyword).toBe('test');
      expect(chunks[0]?.text).toBe('テスト');
    });

    it('should use iTXt for mixed content with non-Latin-1', () => {
      const chunks = createEncodedChunk('test', 'hello テスト', 'dynamic');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('iTXt');
    });
  });

  describe('text-unicode-escape strategy', () => {
    it('should escape non-Latin-1 in tEXt', () => {
      const chunks = createEncodedChunk(
        'test',
        'テスト',
        'text-unicode-escape',
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.keyword).toBe('test');
      expect(chunks[0]?.text).toBe('\\u30c6\\u30b9\\u30c8');
    });

    it('should keep ASCII as-is in tEXt', () => {
      const chunks = createEncodedChunk(
        'test',
        'hello world',
        'text-unicode-escape',
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.text).toBe('hello world');
    });

    it('should escape Latin-1 extended in tEXt', () => {
      const chunks = createEncodedChunk('test', 'café', 'text-unicode-escape');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.text).toBe('caf\\u00e9');
      expect(chunks[0]).toMatchObject({ encoding: 'latin1' });
    });

    it('should escape mixed content beyond Latin-1', () => {
      const chunks = createEncodedChunk(
        'test',
        'hello テスト world',
        'text-unicode-escape',
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.text).toBe('hello \\u30c6\\u30b9\\u30c8 world');
    });
  });

  describe('text-utf8-raw strategy', () => {
    it('should keep raw UTF-8 in tEXt', () => {
      const chunks = createEncodedChunk('test', 'テスト', 'text-utf8-raw');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.keyword).toBe('test');
      expect(chunks[0]?.text).toBe('テスト');
      expect(chunks[0]).toMatchObject({ encoding: 'utf8' });
    });

    it('should keep mixed content as-is', () => {
      const chunks = createEncodedChunk(
        'test',
        'hello テスト world',
        'text-utf8-raw',
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tEXt');
      expect(chunks[0]?.text).toBe('hello テスト world');
    });
  });

  describe('undefined text handling', () => {
    const strategies: ChunkEncodingStrategy[] = [
      'dynamic',
      'text-unicode-escape',
      'text-utf8-raw',
    ];

    for (const strategy of strategies) {
      it(`should return empty array for undefined text (${strategy})`, () => {
        const chunks = createEncodedChunk('test', undefined, strategy);
        expect(chunks).toEqual([]);
      });
    }
  });
});
