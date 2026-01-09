/**
 * HTML rendering functions for the demo site
 */

import type { GenerationMetadata, PngTextChunk } from 'sd-metadata';
import { escapeHtml, getSoftwareLabel, isJson } from './utils';

/**
 * Render image info section
 *
 * @param parsed - Parsed metadata or null
 * @param error - Error message if any
 * @returns HTML string
 */
export function renderImageInfo(
  parsed: GenerationMetadata | null,
  error?: string,
): string {
  const software = parsed?.software || 'Unknown';
  const softwareLabel = getSoftwareLabel(software);

  return `
    <h3>Detected Software</h3>
    <span class="software-badge">${softwareLabel}</span>
    ${error ? `<p style="color: var(--color-error); margin-top: 0.5rem;">Parse error: ${error}</p>` : ''}
  `;
}

/**
 * Render parsed metadata as HTML
 *
 * @param metadata - Parsed generation metadata
 * @returns HTML string
 */
export function renderParsedMetadata(metadata: GenerationMetadata): string {
  const sections: string[] = [];

  // Prompt
  if (metadata.prompt) {
    sections.push(`
      <div class="metadata-section">
        <h4>Prompt</h4>
        <div class="prompt-text">${escapeHtml(metadata.prompt)}</div>
      </div>
    `);
  }

  // Negative Prompt
  if (metadata.negativePrompt) {
    sections.push(`
      <div class="metadata-section">
        <h4>Negative Prompt</h4>
        <div class="prompt-text">${escapeHtml(metadata.negativePrompt)}</div>
      </div>
    `);
  }

  // NovelAI Character Prompts
  if (
    metadata.software === 'novelai' &&
    metadata.characterPrompts &&
    metadata.characterPrompts.length > 0
  ) {
    const chars = metadata.characterPrompts
      .map(
        (char, i) => `
          <div class="character-prompt">
            <div class="character-header">Character ${i + 1}${char.center ? ` (${(char.center.x * 100).toFixed(0)}%, ${(char.center.y * 100).toFixed(0)}%)` : ''}</div>
            <div class="prompt-text">${escapeHtml(char.prompt)}</div>
          </div>
        `,
      )
      .join('');

    sections.push(`
      <div class="metadata-section">
        <h4>Character Prompts</h4>
        ${chars}
      </div>
    `);
  }

  // Generation Settings
  const settings: [string, unknown][] = [];

  // Model
  if (metadata.model) {
    if (metadata.model.name) settings.push(['Model', metadata.model.name]);
    if (metadata.model.hash) settings.push(['Model Hash', metadata.model.hash]);
  }

  // Sampling
  if (metadata.sampling) {
    if (metadata.sampling.sampler)
      settings.push(['Sampler', metadata.sampling.sampler]);
    if (metadata.sampling.scheduler)
      settings.push(['Scheduler', metadata.sampling.scheduler]);
    if (metadata.sampling.steps)
      settings.push(['Steps', metadata.sampling.steps]);
    if (metadata.sampling.cfg)
      settings.push(['CFG Scale', metadata.sampling.cfg]);
    if (metadata.sampling.seed) settings.push(['Seed', metadata.sampling.seed]);
    if (metadata.sampling.clipSkip)
      settings.push(['CLIP Skip', metadata.sampling.clipSkip]);
  }

  // Hires/Upscale
  if (metadata.hires) {
    if (metadata.hires.upscaler)
      settings.push(['Upscaler', metadata.hires.upscaler]);
    if (metadata.hires.scale)
      settings.push(['Hires Scale', metadata.hires.scale]);
    if (metadata.hires.steps)
      settings.push(['Hires Steps', metadata.hires.steps]);
    if (metadata.hires.denoise)
      settings.push(['Hires Denoise', metadata.hires.denoise]);
  }

  // Image Size
  settings.push(['Width', metadata.width]);
  settings.push(['Height', metadata.height]);

  if (settings.length > 0) {
    const fields = settings
      .map(
        ([label, value]) =>
          `<div class="metadata-field"><span class="label">${label}</span><span class="value">${value}</span></div>`,
      )
      .join('');

    sections.push(`
      <div class="metadata-section">
        <h4>Generation Settings</h4>
        ${fields}
      </div>
    `);
  }

  return sections.join('');
}

/**
 * Render raw chunks as collapsible sections
 *
 * @param chunks - PNG text chunks
 * @returns HTML string
 */
export function renderRawChunks(chunks: PngTextChunk[]): string {
  return chunks
    .map((chunk) => {
      const format = isJson(chunk.text) ? 'JSON' : 'Text';

      // Format JSON for display
      let formattedText = chunk.text;
      if (format === 'JSON') {
        try {
          formattedText = JSON.stringify(
            JSON.parse(chunk.text.replace(/\0+$/, '')),
            null,
            2,
          );
        } catch {
          // Keep original if formatting fails
        }
      }

      return `
        <details class="raw-chunk" open>
          <summary class="raw-chunk-header">
            <span class="chunk-keyword">${escapeHtml(chunk.keyword)}</span>
            <span class="chunk-type">${chunk.type}</span>
            <span class="chunk-format">${format}</span>
          </summary>
          <pre class="chunk-content">${escapeHtml(formattedText)}</pre>
        </details>
      `;
    })
    .join('');
}

/**
 * Render error message
 *
 * @param error - Error type or message
 * @returns HTML string
 */
export function renderError(error: string): string {
  return `
    <div class="error-inline">
      <p>Could not parse metadata: ${error || 'Unknown format'}</p>
    </div>
  `;
}
