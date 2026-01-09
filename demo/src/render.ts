/**
 * Component rendering functions for the demo site
 *
 * Uses createElement pattern instead of template literals
 * for better type safety and XSS protection.
 */

import type {
  GenerationMetadata,
  MetadataSegment,
  PngTextChunk,
} from 'sd-metadata';
import { fragment, h } from './dom';
import { formatJson, getSoftwareLabel } from './utils';

// =============================================================================
// Image Info
// =============================================================================

/**
 * Create image info section element
 *
 * @param parsed - Parsed metadata or null
 * @param error - Error message if any
 * @returns HTML element
 */
export function createImageInfo(
  parsed: GenerationMetadata | null,
  error?: string,
): DocumentFragment {
  const software = parsed?.software || 'Unknown';
  const softwareLabel = getSoftwareLabel(software);

  return fragment([
    h('h3', {}, ['Detected Software']),
    h('span', { class: 'software-badge' }, [softwareLabel]),
    error &&
      h('p', { style: 'color: var(--color-error); margin-top: 0.5rem;' }, [
        `Parse error: ${error}`,
      ]),
  ]);
}

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
    sections.push(createSection('Prompt', createPromptText(metadata.prompt)));
  }

  // Negative Prompt
  if (metadata.negativePrompt) {
    sections.push(
      createSection(
        'Negative Prompt',
        createPromptText(metadata.negativePrompt),
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
          `Character ${i + 1}`,
          char.center &&
            ` (${(char.center.x * 100).toFixed(0)}%, ${(char.center.y * 100).toFixed(0)}%)`,
        ]),
        createPromptText(char.prompt),
      ]),
    );
    sections.push(createSection('Character Prompts', fragment(chars)));
  }

  // Generation Settings
  const settings = buildSettingsList(metadata);
  if (settings.length > 0) {
    const fields = settings.map(([label, value]) =>
      h('div', { class: 'metadata-field' }, [
        h('span', { class: 'label' }, [label]),
        h('span', { class: 'value' }, [String(value)]),
      ]),
    );
    sections.push(createSection('Generation Settings', fragment(fields)));
  }

  return fragment(sections);
}

/**
 * Create a metadata section
 */
function createSection(title: string, content: Node): HTMLElement {
  return h('div', { class: 'metadata-section' }, [
    h('h4', {}, [title]),
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
 * Build settings list from metadata
 */
function buildSettingsList(metadata: GenerationMetadata): [string, unknown][] {
  const settings: [string, unknown][] = [];

  // Model
  if (metadata.model) {
    if (metadata.model.name) settings.push(['Model', metadata.model.name]);
    if (metadata.model.hash) settings.push(['Model Hash', metadata.model.hash]);
  }

  // Sampling
  if (metadata.sampling) {
    const s = metadata.sampling;
    if (s.sampler) settings.push(['Sampler', s.sampler]);
    if (s.scheduler) settings.push(['Scheduler', s.scheduler]);
    if (s.steps) settings.push(['Steps', s.steps]);
    if (s.cfg) settings.push(['CFG Scale', s.cfg]);
    if (s.seed) settings.push(['Seed', s.seed]);
    if (s.clipSkip) settings.push(['CLIP Skip', s.clipSkip]);
  }

  // Hires/Upscale
  if (metadata.hires) {
    const h = metadata.hires;
    if (h.upscaler) settings.push(['Upscaler', h.upscaler]);
    if (h.scale) settings.push(['Hires Scale', h.scale]);
    if (h.steps) settings.push(['Hires Steps', h.steps]);
    if (h.denoise) settings.push(['Hires Denoise', h.denoise]);
  }

  // Image Size
  settings.push(['Width', metadata.width]);
  settings.push(['Height', metadata.height]);

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
