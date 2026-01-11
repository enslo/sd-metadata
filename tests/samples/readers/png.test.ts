import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../../../src/readers/png';

describe('PNG Readers - Samples', () => {
  const samplesDir = path.join(__dirname, '../../../samples/png');
  const samples = fs.readdirSync(samplesDir).sort();

  it('should have PNG samples', () => {
    expect(samples.length).toBeGreaterThan(0);
  });

  for (const sample of samples) {
    it(`should read ${sample} without errors`, () => {
      const filePath = path.join(samplesDir, sample);
      const data = fs.readFileSync(filePath);

      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should extract at least some chunks
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  }
});
