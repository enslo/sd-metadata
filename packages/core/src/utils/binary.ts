/**
 * Binary data utilities for reading/writing multi-byte integers.
 * Uses DataView API for endian-aware integer operations.
 */

// ============================================================================
// Conversion
// ============================================================================

/**
 * Convert input to Uint8Array
 *
 * @param input - Image data as Uint8Array or ArrayBuffer
 * @returns Uint8Array view of the data
 */
export function toUint8Array(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof ArrayBuffer ? new Uint8Array(input) : input;
}

// ============================================================================
// Format detection
// ============================================================================

/**
 * Supported image formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * Validates if data starts with PNG signature
 */
export function isPng(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  return (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  );
}

/**
 * Validates if data starts with JPEG signature
 */
export function isJpeg(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  return data[0] === 0xff && data[1] === 0xd8;
}

/**
 * Validates if data starts with WebP signature
 */
export function isWebp(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  return (
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46 && // F
    data[8] === 0x57 && // W
    data[9] === 0x45 && // E
    data[10] === 0x42 && // B
    data[11] === 0x50 // P
  );
}

/**
 * Detect image format from magic bytes
 */
export function detectFormat(data: Uint8Array): ImageFormat | null {
  if (isPng(data)) return 'png';
  if (isJpeg(data)) return 'jpeg';
  if (isWebp(data)) return 'webp';
  return null;
}

// ============================================================================
// Read
// ============================================================================

/**
 * Read 2-byte big-endian unsigned integer
 */
export function readUint16BE(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(
    offset,
  );
}

/**
 * Read 2-byte unsigned integer with configurable endianness
 */
export function readUint16(
  data: Uint8Array,
  offset: number,
  isLittleEndian: boolean,
): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(
    offset,
    isLittleEndian,
  );
}

/**
 * Read 3-byte little-endian unsigned integer.
 * No DataView equivalent (getUint24 does not exist).
 * Used for WebP VP8X width/height fields.
 */
export function readUint24LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16)
  );
}

/**
 * Read 4-byte big-endian unsigned integer
 */
export function readUint32BE(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    offset,
  );
}

/**
 * Read 4-byte little-endian unsigned integer
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    offset,
    true,
  );
}

/**
 * Read 4-byte unsigned integer with configurable endianness
 */
export function readUint32(
  data: Uint8Array,
  offset: number,
  isLittleEndian: boolean,
): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    offset,
    isLittleEndian,
  );
}

/**
 * Read 4-byte chunk type as ASCII string
 *
 * @param data - Byte array
 * @param offset - Offset to start reading from
 * @returns 4-character ASCII string
 */
export function readChunkType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 0,
  );
}

// ============================================================================
// Write
// ============================================================================

/**
 * Write 2-byte big-endian unsigned integer
 */
export function writeUint16BE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint16(
    offset,
    value,
  );
}

/**
 * Write 2-byte unsigned integer with configurable endianness
 */
export function writeUint16(
  data: Uint8Array,
  offset: number,
  value: number,
  isLittleEndian: boolean,
): void {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint16(
    offset,
    value,
    isLittleEndian,
  );
}

/**
 * Write 4-byte big-endian unsigned integer
 */
export function writeUint32BE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(
    offset,
    value,
  );
}

/**
 * Write 4-byte little-endian unsigned integer
 */
export function writeUint32LE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(
    offset,
    value,
    true,
  );
}

/**
 * Write 4-byte unsigned integer with configurable endianness
 */
export function writeUint32(
  data: Uint8Array,
  offset: number,
  value: number,
  isLittleEndian: boolean,
): void {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(
    offset,
    value,
    isLittleEndian,
  );
}
