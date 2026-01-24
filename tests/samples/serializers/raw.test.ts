import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read } from '../../../src/index';
import { formatRaw } from '../../../src/serializers/raw';

describe('formatRaw - Samples', () => {
  const loadSample = (format: 'png' | 'jpg' | 'webp', filename: string) => {
    const filePath = path.join(
      __dirname,
      `../../../samples/${format}`,
      filename,
    );
    return fs.readFileSync(filePath);
  };

  describe('GIMP samples (unrecognized metadata)', () => {
    it('should format gimp.png', () => {
      const data = loadSample('png', 'gimp.png');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('GIMPで再保存しただけ');
      }
    });

    it('should format gimp-en.png', () => {
      const data = loadSample('png', 'gimp-en.png');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('Created with GIMP');
      }
    });

    it('should format gimp.jpg', () => {
      const data = loadSample('jpg', 'gimp.jpg');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('GIMPで再保存しただけ');
      }
    });

    it('should format gimp.webp', () => {
      const data = loadSample('webp', 'gimp.webp');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('GIMPで再保存しただけ\n\nGIMP 3.0.6');
      }
    });
  });

  describe('AI-generated samples (success metadata)', () => {
    it('should format raw metadata from novelai-curated.png', () => {
      const data = loadSample('png', 'novelai-curated.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const formatted = formatRaw(result.raw);
        // Raw should contain the original text content (NovelAI stores JSON in Comment chunk)
        expect(formatted).toContain('hatsune miku');
        expect(formatted.length).toBeGreaterThan(0);
      }
    });

    it('should format raw metadata from comfyui.png', () => {
      const data = loadSample('png', 'comfyui.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const formatted = formatRaw(result.raw);
        // Raw should contain workflow data (node IDs and class types)
        expect(formatted).toContain('CheckpointLoader');
        expect(formatted).toContain('KSampler');
        expect(formatted.length).toBeGreaterThan(0);
      }
    });
  });
});
