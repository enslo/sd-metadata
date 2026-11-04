/**
 * Shared metadata output logic for the Output and Copy to Image tabs
 */

import type { EmbedMetadata, ParseResult } from '@enslo/sd-metadata';
import { embed, write } from '@enslo/sd-metadata';

export type MetadataMode = 'keep' | 'strip' | 'edit';
export type MetadataFormat = 'original' | 'a1111';

export const METADATA_FORMATS: MetadataFormat[] = ['original', 'a1111'];

export const EMPTY_METADATA: EmbedMetadata = {
  prompt: '',
  negativePrompt: '',
  width: 0,
  height: 0,
};

/** Editable copy of the parsed metadata, or an empty form */
export function toEmbedMetadata(parseResult: ParseResult): EmbedMetadata {
  if (parseResult.status !== 'success') return EMPTY_METADATA;
  return parseResult.metadata;
}

/** Whether the loaded metadata can be written back as it is */
export function canKeepMetadata(parseResult: ParseResult): boolean {
  return (
    parseResult.status === 'success' || parseResult.status === 'unrecognized'
  );
}

/** Pick the default metadata mode for a parse result */
export function defaultMode(parseResult: ParseResult): MetadataMode {
  switch (parseResult.status) {
    case 'success':
    case 'unrecognized':
      return 'keep';
    case 'empty':
      return 'edit';
    default:
      return 'strip';
  }
}

export function isMetadataFormat(v: string): v is MetadataFormat {
  return (METADATA_FORMATS as string[]).includes(v);
}

/** What to write: the loaded metadata as it is, nothing, or the edited form */
export interface OutputPlan {
  mode: MetadataMode;
  metadataFormat: MetadataFormat;
  metadata: EmbedMetadata;
  extras: Record<string, string | number>;
}

/**
 * Write the planned metadata into an image
 *
 * @returns The new image bytes and a filename suffix describing what was
 *   written (empty when the loaded metadata was kept as it is)
 */
export function applyMetadata(
  baseData: Uint8Array,
  parseResult: ParseResult,
  plan: OutputPlan,
): { data: Uint8Array; suffix: string } {
  if (plan.mode === 'strip') {
    const result = write(baseData, { status: 'empty' });
    if (!result.ok) throw new Error(result.error.type);
    return { data: result.value, suffix: '_noinfo' };
  }
  if (plan.mode === 'edit') {
    const result = embed(baseData, { ...plan.metadata, extras: plan.extras });
    if (!result.ok) throw new Error(result.error.type);
    return { data: result.value, suffix: '_edited' };
  }
  if (plan.metadataFormat === 'a1111' && parseResult.status === 'success') {
    const result = embed(baseData, parseResult.metadata);
    if (!result.ok) throw new Error(result.error.type);
    return { data: result.value, suffix: '_a1111' };
  }
  const result = write(baseData, parseResult);
  if (!result.ok) throw new Error(result.error.type);
  return { data: result.value, suffix: '' };
}
