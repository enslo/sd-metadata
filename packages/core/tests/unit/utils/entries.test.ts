import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractFromCommentJson,
  parseEntryJson,
  rememberEntryJson,
} from '../../../src/utils/entries';
import { parseJson } from '../../../src/utils/json';

/** A ComfyUI save for JPEG/WebP: the API prompt inside one JSON object */
const GRAPH_TEXT = JSON.stringify({
  prompt: {
    6: { class_type: 'CLIPTextEncode', inputs: { text: '1girl, solo' } },
  },
});

const SEED_TEXT = '{"seed": 42}';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseEntryJson', () => {
  it('parses the JSON text of an entry', () => {
    const result = parseEntryJson({ UserComment: GRAPH_TEXT }, 'UserComment');

    expect(result).toEqual(parseJson(GRAPH_TEXT));
  });

  it('answers undefined for an entry the record does not have', () => {
    const result = parseEntryJson({ UserComment: GRAPH_TEXT }, 'Comment');

    expect(result).toBeUndefined();
  });

  it('reports broken JSON as a failed parse', () => {
    const result = parseEntryJson(
      { UserComment: '{"prompt": {"6": {"class_type": "CLIPTextEncode"' },
      'UserComment',
    );

    expect(result?.ok).toBe(false);
  });

  it('parses an entry once per record', () => {
    const entries = { UserComment: GRAPH_TEXT };
    const jsonParse = vi.spyOn(JSON, 'parse');

    const first = parseEntryJson(entries, 'UserComment');
    const second = parseEntryJson(entries, 'UserComment');

    expect(second).toBe(first);
    expect(jsonParse).toHaveBeenCalledTimes(1);
  });

  it('keeps the entries of one record apart', () => {
    const entries = { UserComment: GRAPH_TEXT, Comment: SEED_TEXT };

    expect(parseEntryJson(entries, 'Comment')).toEqual(parseJson(SEED_TEXT));
    expect(parseEntryJson(entries, 'UserComment')).toEqual(
      parseJson(GRAPH_TEXT),
    );
  });

  it('does not share a result between two records', () => {
    const jsonParse = vi.spyOn(JSON, 'parse');

    const first = parseEntryJson({ UserComment: GRAPH_TEXT }, 'UserComment');
    const second = parseEntryJson({ UserComment: GRAPH_TEXT }, 'UserComment');

    expect(second).not.toBe(first);
    expect(jsonParse).toHaveBeenCalledTimes(2);
  });
});

describe('rememberEntryJson', () => {
  it('hands the remembered result to parseEntryJson without another parse', () => {
    const entries = { UserComment: GRAPH_TEXT };
    const remembered = rememberEntryJson(
      entries,
      'UserComment',
      GRAPH_TEXT,
      parseJson(GRAPH_TEXT),
    );
    const jsonParse = vi.spyOn(JSON, 'parse');

    expect(parseEntryJson(entries, 'UserComment')).toBe(remembered);
    expect(jsonParse).not.toHaveBeenCalled();
  });

  it('is not used once the entry holds another text', () => {
    // A later segment of the same kind replaces the text of the entry
    const entries: Record<string, string> = {};
    rememberEntryJson(
      entries,
      'UserComment',
      GRAPH_TEXT,
      parseJson(GRAPH_TEXT),
    );
    entries.UserComment = SEED_TEXT;

    expect(parseEntryJson(entries, 'UserComment')).toEqual(
      parseJson(SEED_TEXT),
    );
  });
});

describe('extractFromCommentJson', () => {
  it('returns a string field as it is', () => {
    const entries = {
      UserComment: JSON.stringify({ extra: '{"prompt": "1girl, solo"}' }),
    };

    expect(extractFromCommentJson(entries, 'extra')).toBe(
      '{"prompt": "1girl, solo"}',
    );
  });

  it('returns an object field as JSON text', () => {
    const entries = {
      UserComment: JSON.stringify({ invokeai_metadata: { seed: 42 } }),
    };

    expect(extractFromCommentJson(entries, 'invokeai_metadata')).toBe(
      '{"seed":42}',
    );
  });

  it('returns undefined for a field that is missing or not text or object', () => {
    const entries = { UserComment: '{"seed": 42}' };

    expect(extractFromCommentJson(entries, 'prompt')).toBeUndefined();
    expect(extractFromCommentJson(entries, 'seed')).toBeUndefined();
  });

  it('returns undefined when the UserComment is not a JSON object', () => {
    expect(
      extractFromCommentJson({ UserComment: '1girl, solo' }, 'prompt'),
    ).toBeUndefined();
    expect(
      extractFromCommentJson({ UserComment: '{"prompt": ' }, 'prompt'),
    ).toBeUndefined();
    expect(extractFromCommentJson({}, 'prompt')).toBeUndefined();
  });

  it('parses the UserComment once for several fields', () => {
    // TensorArt reads generation_data and prompt from the same UserComment
    const entries = {
      UserComment: JSON.stringify({
        generation_data: '{"prompt": "1girl, solo"}',
        prompt: { 6: { class_type: 'CLIPTextEncode', inputs: {} } },
      }),
    };
    const jsonParse = vi.spyOn(JSON, 'parse');

    extractFromCommentJson(entries, 'generation_data');
    extractFromCommentJson(entries, 'prompt');

    expect(jsonParse).toHaveBeenCalledTimes(1);
  });
});
