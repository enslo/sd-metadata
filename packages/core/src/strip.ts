/**
 * sd-metadata/strip - Remove all metadata from an image, stealth data
 * included
 *
 * A separate entry point: the code that rewrites pixels is only loaded by
 * those who strip, not by every reader.
 */

export { strip } from './api/strip';
export type { StripResult, StripWarning } from './types';
