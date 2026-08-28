/**
 * Stealth rescue write-back: recover metadata from pixel LSBs after
 * the regular metadata was stripped, then write it back as standard
 * metadata with the existing write() API.
 *
 * parse() synthesizes chunk-shaped raw metadata from the stealth
 * payload, so the recovered ParseResult feeds write() directly — the
 * original tool's native layout is restored without any stealth-write
 * support.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/api/parse';
import { read } from '../../src/api/read';
import { write } from '../../src/api/write';
import { loadSample } from '../helpers/samples';
import { stripTextChunks } from '../helpers/stealth-images';
import { decodeWithSharp } from '../helpers/webp-pixels';

describe('stealth rescue write-back', () => {
  it('restores NovelAI-native chunks to a stripped PNG', async () => {
    const original = loadSample('png', 'novelai-full.png');
    const baseline = read(original);
    expect(baseline.status).toBe('success');

    const stripped = stripTextChunks(original);
    const rescued = await parse(stripped);
    expect(rescued.status).toBe('success');
    if (baseline.status !== 'success' || rescued.status !== 'success') {
      return;
    }

    const restored = write(stripped, rescued);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }

    // The restored file reads back through the regular chunk path.
    const reread = read(restored.value);
    expect(reread.status).toBe('success');
    if (reread.status === 'success') {
      expect(reread.metadata).toEqual(baseline.metadata);
      expect(reread.metadata.software).toBe('novelai');
    }
  });

  it('restores ComfyUI prompt/workflow chunks to a stripped PNG', async () => {
    const original = loadSample('png', 'comfyui-stealth-alpha-comp.png');
    const baseline = read(original);
    expect(baseline.status).toBe('success');

    const stripped = stripTextChunks(original);
    const rescued = await parse(stripped);
    expect(rescued.status).toBe('success');
    if (baseline.status !== 'success' || rescued.status !== 'success') {
      return;
    }

    const restored = write(stripped, rescued);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }

    const reread = read(restored.value);
    expect(reread.status).toBe('success');
    if (reread.status === 'success') {
      expect(reread.metadata).toEqual(baseline.metadata);
      expect(reread.metadata.software).toBe('comfyui');
    }
  });

  it('restores NovelAI EXIF to a stripped WebP via cross-format conversion', async () => {
    const original = loadSample('webp', 'novelai-curated.webp');
    const baseline = read(original);
    expect(baseline.status).toBe('success');

    const strippedResult = write(original, { status: 'empty' });
    expect(strippedResult.ok).toBe(true);
    if (!strippedResult.ok) {
      return;
    }

    // Recovery needs decoded pixels (sharp stands in for the browser
    // platform decoder); the rescued raw metadata is chunk-shaped, so
    // write() converts it to the WebP EXIF layout NovelAI uses.
    const rescued = await parse(strippedResult.value, {
      decodePixels: decodeWithSharp,
    });
    expect(rescued.status).toBe('success');
    if (baseline.status !== 'success' || rescued.status !== 'success') {
      return;
    }

    const restored = write(strippedResult.value, rescued);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }

    const reread = read(restored.value);
    expect(reread.status).toBe('success');
    if (reread.status === 'success') {
      expect(reread.metadata).toEqual(baseline.metadata);
    }
  });
});
