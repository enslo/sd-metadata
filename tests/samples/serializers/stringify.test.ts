import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read } from '../../../src/index';
import { formatAsWebUI } from '../../../src/serializers/a1111';
import { formatRaw } from '../../../src/serializers/raw';
import { stringify } from '../../../src/serializers/stringify';

describe('stringify - Samples', () => {
  const loadSample = (format: 'png' | 'jpg' | 'webp', filename: string) => {
    const filePath = path.join(
      __dirname,
      `../../../samples/${format}`,
      filename,
    );
    return fs.readFileSync(filePath);
  };

  describe('success samples (should match formatAsWebUI)', () => {
    it('should stringify sd-webui PNG', () => {
      const data = loadSample('png', 'sd-webui.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(formatAsWebUI(result.metadata));
      }
    });

    it('should stringify novelai PNG', () => {
      const data = loadSample('png', 'novelai-curated.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(formatAsWebUI(result.metadata));
      }
    });

    it('should stringify comfyui PNG', () => {
      const data = loadSample('png', 'comfyui.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(formatAsWebUI(result.metadata));
      }
    });

    it('should stringify forge JPEG', () => {
      const data = loadSample('jpg', 'forge-classic-hires.jpeg');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(formatAsWebUI(result.metadata));
      }
    });

    it('should stringify novelai WebP', () => {
      const data = loadSample('webp', 'novelai-curated.webp');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(formatAsWebUI(result.metadata));
      }
    });
  });

  describe('unrecognized samples (should match formatRaw)', () => {
    it('should stringify gimp.png', () => {
      const data = loadSample('png', 'gimp.png');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        expect(stringify(result)).toBe(formatRaw(result.raw));
      }
    });

    it('should stringify gimp.jpg', () => {
      const data = loadSample('jpg', 'gimp.jpg');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        expect(stringify(result)).toBe(formatRaw(result.raw));
      }
    });

    it('should stringify gimp.webp', () => {
      const data = loadSample('webp', 'gimp.webp');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        expect(stringify(result)).toBe(formatRaw(result.raw));
      }
    });
  });

  describe('empty samples', () => {
    it('should return empty string for empty.png', () => {
      const data = loadSample('png', 'empty.png');
      const result = read(data);

      expect(result.status).toBe('empty');
      expect(stringify(result)).toBe('');
    });

    it('should return empty string for empty.jpg', () => {
      const data = loadSample('jpg', 'empty.jpg');
      const result = read(data);

      expect(result.status).toBe('empty');
      expect(stringify(result)).toBe('');
    });

    it('should return empty string for empty.webp', () => {
      const data = loadSample('webp', 'empty.webp');
      const result = read(data);

      expect(result.status).toBe('empty');
      expect(stringify(result)).toBe('');
    });
  });
});
