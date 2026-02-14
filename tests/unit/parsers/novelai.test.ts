import { describe, expect, it } from 'vitest';
import { parseNovelAI } from '../../../src/parsers/novelai';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create NovelAI metadata entries
 */
function createNovelAIEntries(commentJson: string): EntryRecord {
  return {
    Software: 'NovelAI',
    Comment: commentJson,
  };
}

describe('parseNovelAI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing Comment', () => {
      const entries: EntryRecord = { Software: 'NovelAI' };

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries = createNovelAIEntries('not valid json');

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal NovelAI metadata', () => {
      const comment = JSON.stringify({
        prompt: 'a beautiful landscape',
        uc: 'lowres, bad quality',
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract dimensions', () => {
      const comment = JSON.stringify({
        prompt: 'test',
        width: 512,
        height: 768,
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings', () => {
      const comment = JSON.stringify({
        prompt: 'test',
        steps: 28,
        scale: 7.5,
        seed: 123456,
        sampler: 'k_euler',
        noise_schedule: 'native',
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          steps: 28,
          cfg: 7.5,
          seed: 123456,
          sampler: 'k_euler',
          scheduler: 'native',
        });
      }
    });
  });

  describe('V4 prompt structure', () => {
    it('should prefer V4 base_caption over legacy prompt', () => {
      const comment = JSON.stringify({
        prompt: 'old prompt',
        v4_prompt: {
          caption: {
            base_caption: 'new v4 prompt',
          },
        },
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('new v4 prompt');
      }
    });

    it('should extract V4 character prompts', () => {
      const comment = JSON.stringify({
        prompt: 'base',
        v4_prompt: {
          caption: {
            base_caption: 'background',
            char_captions: [
              {
                char_caption: 'char1 description',
                centers: [{ x: 0.25, y: 0.5 }],
              },
              {
                char_caption: 'char2 description',
                centers: [{ x: 0.75, y: 0.5 }],
              },
            ],
          },
          use_coords: true,
          use_order: false,
        },
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.software === 'novelai') {
        expect(result.value.characterPrompts).toHaveLength(2);
        expect(result.value.characterPrompts?.[0]).toMatchObject({
          prompt: 'char1 description',
          center: { x: 0.25, y: 0.5 },
        });
        expect(result.value.useCoords).toBe(true);
        expect(result.value.useOrder).toBe(false);
      }
    });

    it('should handle V4 negative prompt', () => {
      const comment = JSON.stringify({
        prompt: 'test',
        uc: 'old negative',
        v4_negative_prompt: {
          caption: {
            base_caption: 'new v4 negative',
          },
        },
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.negativePrompt).toBe('new v4 negative');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const comment = JSON.stringify({
        prompt: 'test prompt',
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test prompt');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
        expect(result.value.sampling).toBeUndefined();
      }
    });

    it('should handle empty character captions', () => {
      const comment = JSON.stringify({
        prompt: 'test',
        v4_prompt: {
          caption: {
            base_caption: 'base',
            char_captions: [
              { char_caption: undefined },
              { char_caption: 'valid' },
            ],
          },
        },
      });
      const entries = createNovelAIEntries(comment);

      const result = parseNovelAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.software === 'novelai') {
        // Should filter out invalid character captions
        expect(result.value.characterPrompts).toHaveLength(1);
        expect(result.value.characterPrompts?.at(0)?.prompt).toBe('valid');
      }
    });
  });
});
