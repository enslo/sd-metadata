import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJpegMetadata } from '../../../src/readers/jpeg';

describe('JPEG Readers - Samples', () => {
  const samplesDir = path.join(__dirname, '../../../samples/jpg');
  const samples = fs.readdirSync(samplesDir).sort();

  it('should have JPEG samples', () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  for (const sample of samples) {
    it(`should read ${sample} without errors`, () => {
      const filePath = path.join(samplesDir, sample);
      const data = fs.readFileSync(filePath);

      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should extract at least some segments
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  }
});
