/**
 * Component rendering functions for the demo site
 *
 * Uses createElement pattern instead of template literals
 * for better type safety and XSS protection.
 */

import type { GenerationMetadata, RawMetadata } from 'sd-metadata';
import { fragment, h } from './dom';
import { formatJson, getSoftwareLabel } from './utils';

// Type aliases derived from RawMetadata (internal types are not exported)
type PngTextChunk = Extract<RawMetadata, { format: 'png' }>['chunks'][number];
type MetadataSegment = Extract<
  RawMetadata,
  { format: 'jpeg' }
>['segments'][number];

// =============================================================================
// Image Info
// =============================================================================

/**
 * Create image info section element (filename only)
 *
 * @param filename - Name of the uploaded file
 * @param error - Error message if any
 * @returns HTML element
 */
export function createImageInfo(
  filename: string,
  error?: string,
): DocumentFragment {
  return fragment([
    h('h3', { class: 'filename', title: filename }, [filename]),
    error &&
      h('p', { style: 'color: var(--color-error); margin-top: 0.5rem;' }, [
        `Parse error: ${error}`,
      ]),
  ]);
}

/**
 * Get software label for display
 */
export { getSoftwareLabel };

// =============================================================================
// Parsed Metadata
// =============================================================================

/**
 * Create parsed metadata view
 *
 * @param metadata - Parsed generation metadata
 * @returns HTML element
 */
export function createParsedMetadata(
  metadata: GenerationMetadata,
): DocumentFragment {
  const sections: Node[] = [];

  // Prompt
  if (metadata.prompt) {
    sections.push(
      createSection(
        'Prompt',
        createPromptText(metadata.prompt),
        metadata.prompt,
      ),
    );
  }

  // Negative Prompt
  if (metadata.negativePrompt) {
    sections.push(
      createSection(
        'Negative Prompt',
        createPromptText(metadata.negativePrompt),
        metadata.negativePrompt,
      ),
    );
  }

  // NovelAI Character Prompts
  if (
    metadata.software === 'novelai' &&
    metadata.characterPrompts &&
    metadata.characterPrompts.length > 0
  ) {
    const chars = metadata.characterPrompts.map((char, i) =>
      h('div', { class: 'character-prompt' }, [
        h('div', { class: 'character-header' }, [
          h('span', {}, [
            `Character ${i + 1}`,
            char.center &&
              ` (${(char.center.x * 100).toFixed(0)}%, ${(char.center.y * 100).toFixed(0)}%)`,
          ]),
          createCopyButton(char.prompt),
        ]),
        createPromptText(char.prompt),
      ]),
    );
    sections.push(createSection('Character Prompts', fragment(chars)));
  }

  // Generation Settings
  const settings = buildSettingsList(metadata);
  if (settings.length > 0) {
    const fields = settings.map(([label, value, copyable]) =>
      h('div', { class: 'metadata-field' }, [
        h('span', { class: 'label' }, [label]),
        h('span', { class: 'value' }, [
          String(value),
          copyable && createCopyButton(String(value)),
        ]),
      ]),
    );
    sections.push(createSection('Generation Settings', fragment(fields)));
  }

  return fragment(sections);
}

/**
 * Create a metadata section with optional copy button
 */
function createSection(
  title: string,
  content: Node,
  copyValue?: string,
): HTMLElement {
  return h('div', { class: 'metadata-section' }, [
    h('div', { class: 'section-header' }, [
      h('h4', {}, [title]),
      copyValue !== undefined && createCopyButton(copyValue),
    ]),
    content,
  ]);
}

/**
 * Create prompt text element
 */
function createPromptText(text: string): HTMLElement {
  return h('div', { class: 'prompt-text' }, [text]);
}

/**
 * Create a copy button
 */
function createCopyButton(value: string): HTMLButtonElement {
  const btn = h('button', { class: 'copy-btn', title: 'Copy to clipboard' }, [
    '📋',
  ]);
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋';
        btn.classList.remove('copied');
      }, 1500);
    } catch {
      btn.textContent = '✗';
      setTimeout(() => {
        btn.textContent = '📋';
      }, 1500);
    }
  });
  return btn;
}

/**
 * Build settings list from metadata
 * Returns [label, value, copyable] tuples
 */
function buildSettingsList(
  metadata: GenerationMetadata,
): [string, unknown, boolean][] {
  const settings: [string, unknown, boolean][] = [];

  // Model
  if (metadata.model) {
    if (metadata.model.name)
      settings.push(['Model', metadata.model.name, false]);
    if (metadata.model.hash)
      settings.push(['Model Hash', metadata.model.hash, false]);
  }

  // Sampling
  if (metadata.sampling) {
    const s = metadata.sampling;
    if (s.sampler) settings.push(['Sampler', s.sampler, false]);
    if (s.scheduler) settings.push(['Scheduler', s.scheduler, false]);
    if (s.steps) settings.push(['Steps', s.steps, false]);
    if (s.cfg) settings.push(['CFG Scale', s.cfg, false]);
    if (s.seed) settings.push(['Seed', s.seed, true]); // Copyable!
    if (s.clipSkip) settings.push(['CLIP Skip', s.clipSkip, false]);
  }

  // Hires/Upscale
  if (metadata.hires) {
    const hr = metadata.hires;
    if (hr.upscaler) settings.push(['Upscaler', hr.upscaler, false]);
    if (hr.scale) settings.push(['Hires Scale', hr.scale, false]);
    if (hr.steps) settings.push(['Hires Steps', hr.steps, false]);
    if (hr.denoise) settings.push(['Hires Denoise', hr.denoise, false]);
  }

  // Upscale (post-generation)
  if (metadata.upscale) {
    const u = metadata.upscale;
    if (u.upscaler) settings.push(['Upscaler', u.upscaler, false]);
    if (u.scale) settings.push(['Upscale Factor', u.scale, false]);
  }

  // Image Size
  settings.push(['Width', metadata.width, false]);
  settings.push(['Height', metadata.height, false]);

  return settings;
}

// =============================================================================
// Raw Chunks
// =============================================================================

/**
 * Create raw chunks view
 *
 * @param chunks - PNG text chunks
 * @returns HTML element
 */
export function createRawChunks(chunks: PngTextChunk[]): DocumentFragment {
  const elements = chunks.map((chunk) => {
    const { formatted, isJson } = formatJson(chunk.text);
    const format = isJson ? 'JSON' : 'Text';

    return h('details', { class: 'raw-chunk', open: true }, [
      h('summary', { class: 'raw-chunk-header' }, [
        h('span', { class: 'chunk-keyword' }, [chunk.keyword]),
        h('span', { class: 'chunk-type' }, [chunk.type]),
        h('span', { class: 'chunk-format' }, [format]),
      ]),
      h('pre', { class: 'chunk-content' }, [formatted]),
    ]);
  });

  return fragment(elements);
}

/**
 * Create Exif segments view (for JPEG/WebP)
 *
 * @param segments - Metadata segments
 * @returns HTML element
 */
export function createExifSegments(
  segments: MetadataSegment[],
): DocumentFragment {
  const elements = segments.map((segment) => {
    const { formatted, isJson } = formatJson(segment.data);
    const format = isJson ? 'JSON' : 'Text';
    const sourceType = segment.source.type;
    const prefix =
      'prefix' in segment.source ? segment.source.prefix : undefined;

    const label = prefix ? `${sourceType} (${prefix})` : sourceType;

    return h('details', { class: 'raw-chunk', open: true }, [
      h('summary', { class: 'raw-chunk-header' }, [
        h('span', { class: 'chunk-keyword' }, [label]),
        h('span', { class: 'chunk-format' }, [format]),
      ]),
      h('pre', { class: 'chunk-content' }, [formatted]),
    ]);
  });

  return fragment(elements);
}

// =============================================================================
// Error
// =============================================================================

/**
 * Create error message element
 *
 * @param error - Error type or message
 * @returns HTML element
 */
export function createError(error: string): HTMLElement {
  return h('div', { class: 'error-inline' }, [
    h('p', {}, [`Could not parse metadata: ${error || 'Unknown format'}`]),
  ]);
}
