import { describe, expect, it } from 'vitest';
import {
  createITxtChunk,
  createTextChunk,
} from '../../../src/converters/utils';

describe('createTextChunk', () => {
  it('should create tEXt chunk with text', () => {
    const chunks = createTextChunk('test', 'hello');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      type: 'tEXt',
      keyword: 'test',
      text: 'hello',
    });
  });

  it('should return empty array for undefined text', () => {
    expect(createTextChunk('test', undefined)).toEqual([]);
  });
});

describe('createITxtChunk', () => {
  it('should create iTXt chunk with text', () => {
    const chunks = createITxtChunk('test', 'hello');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      type: 'iTXt',
      keyword: 'test',
      compressionFlag: 0,
      compressionMethod: 0,
      languageTag: '',
      translatedKeyword: '',
      text: 'hello',
    });
  });

  it('should return empty array for undefined text', () => {
    expect(createITxtChunk('test', undefined)).toEqual([]);
  });
});
