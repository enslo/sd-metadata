import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWebpMetadata } from '../../../src/readers/webp';

describe('WebP Readers - Samples', () => {
  const samplesDir = path.join(__dirname, '../../../samples/webp');
  const samples = fs.readdirSync(samplesDir).sort();

  it('should have WebP samples', () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  for (const sample of samples) {
    it(`should read ${sample} without errors`, () => {
      const filePath = path.join(samplesDir, sample);
      const data = fs.readFileSync(filePath);

      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      // WebP may not have EXIF data, so we don't check value.length
    });
  }
});
