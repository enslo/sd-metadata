import fs from 'node:fs';
import path from 'node:path';
import { read } from '../../src/index';
import { readPngMetadata } from '../../src/readers/png';
import type { InternalParseResult, MetadataEntry } from '../../src/types';

/**
 * Read a PNG sample file and parse it with the given parser
 *
 * @param filename - Sample filename (e.g., 'novelai-curated.png')
 * @param parser - Parser function to use
 * @returns Parsed metadata
 * @throws If reading or parsing fails
 */
export function parsePngSample<T>(
  filename: string,
  parser: (entries: MetadataEntry[]) => InternalParseResult,
): T {
  const filePath = path.join(__dirname, '../../samples/png', filename);
  const data = fs.readFileSync(filePath);
  const chunksResult = readPngMetadata(data);

  if (!chunksResult.ok) {
    throw new Error(`Failed to read PNG metadata: ${chunksResult.error}`);
  }

  const result = parser(chunksResult.value);

  if (!result.ok) {
    throw new Error(`Failed to parse metadata: ${result.error.type}`);
  }

  return result.value as T;
}

/**
 * Read a WebP or JPEG sample file using the high-level read() API
 *
 * Note: WebP and JPEG samples go through internal conversion,
 * so we use the read() API instead of low-level readers.
 *
 * @param format - Sample format ('webp' or 'jpeg')
 * @param filename - Sample filename (e.g., 'novelai-curated.webp')
 * @returns Parsed metadata
 * @throws If reading or parsing fails
 */
export function parseConvertedSample<T>(
  format: 'webp' | 'jpeg',
  filename: string,
): T {
  const dirName = format === 'webp' ? 'webp' : 'jpg';
  const filePath = path.join(__dirname, '../../samples', dirName, filename);
  const data = fs.readFileSync(filePath);
  const result = read(data);

  if (result.status !== 'success') {
    throw new Error(`Failed to read sample: status=${result.status}`);
  }

  return result.metadata as T;
}
