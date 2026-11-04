import { describe, expect, it } from 'vitest';
import { parseDezgo } from '../../../src/parsers/dezgo';

/** YAML job record as Dezgo writes it into the EXIF UserComment */
function yamlJob(...inputLines: string[]): string {
  return `\nJobId: job\nFunction: image2image\nInput:\n${inputLines
    .map((line) => `  ${line}`)
    .join('\n')}\n`;
}

describe('parseDezgo - Unit Tests', () => {
  it('should read LoRA slots from YAML, skipping slots without a hash', () => {
    const result = parseDezgo({
      UserComment: yamlJob(
        'prompt: a cat',
        'lora1_strength: 1',
        'lora2: ABCD',
        'lora2_strength: 0.5',
        'lora4: EF01',
        'lora4_strength: -1.2',
      ),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'ABCD', hash: 'ABCD', weight: 0.5 },
        { name: 'EF01', hash: 'EF01', weight: -1.2 },
      ]);
    }
  });

  it('should read the image2image strength as the main pass denoise', () => {
    const result = parseDezgo({
      UserComment: yamlJob('prompt: a cat', 'strength: 0.35', 'steps: 30'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sampling).toEqual({ steps: 30, denoise: 0.35 });
    }
  });

  it('should read the YAML when GenInfo is not valid JSON', () => {
    const result = parseDezgo({
      GenInfo: '{"JobId": "job", "Function": "x", "Input": ',
      UserComment: yamlJob('prompt: from yaml'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt).toBe('from yaml');
    }
  });

  it('should prefer GenInfo over the YAML', () => {
    const result = parseDezgo({
      GenInfo: JSON.stringify({ Input: { prompt: 'from json' } }),
      UserComment: yamlJob('prompt: from yaml'),
    });

    expect(result.ok && result.value.prompt).toBe('from json');
  });

  it('should return an error without a job input', () => {
    expect(parseDezgo({ UserComment: 'JobId: job' }).ok).toBe(false);
    expect(parseDezgo({}).ok).toBe(false);
  });
});
