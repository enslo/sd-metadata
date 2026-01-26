/**
 * Binary data utilities for reading/writing multi-byte integers
 */

/**
 * Convert input to Uint8Array
 *
 * @param input - Image data as Uint8Array or ArrayBuffer
 * @returns Uint8Array view of the data
 */
export function toUint8Array(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof ArrayBuffer ? new Uint8Array(input) : input;
}

/**
 * Read 3-byte little-endian unsigned integer
 *
 * @param data - Byte array
 * @param offset - Offset to start reading from
 * @returns 24-bit unsigned integer
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
 *
 * @param data - Byte array
 * @param offset - Offset to start reading from
 * @returns 32-bit unsigned integer
 */
export function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) << 24) |
    ((data[offset + 1] ?? 0) << 16) |
    ((data[offset + 2] ?? 0) << 8) |
    (data[offset + 3] ?? 0)
  );
}

/**
 * Read 4-byte little-endian unsigned integer
 *
 * @param data - Byte array
 * @param offset - Offset to start reading from
 * @returns 32-bit unsigned integer
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16) |
    ((data[offset + 3] ?? 0) << 24)
  );
}

/**
 * Write 4-byte big-endian unsigned integer
 *
 * @param data - Byte array to write to
 * @param offset - Offset to start writing at
 * @param value - 32-bit unsigned integer value
 */
export function writeUint32BE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
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

/**
 * Read 2-byte unsigned integer with endianness support
 *
 * @param data - Byte array
 * @param offset - Offset to start reading from
 * @param isLittleEndian - If true, read as little-endian
 * @returns 16-bit unsigned integer
 */
export function readUint16(
  data: Uint8Array,
  offset: number,
  isLittleEndian: boolean,
): number {
  if (isLittleEndian) {
    return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
  }
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

/**
 * Read 4-byte unsigned integer with endianness support
 *
 * @param data - Byte array
 * @param offset - Offset to start reading from
 * @param isLittleEndian - If true, read as little-endian
 * @returns 32-bit unsigned integer
 */
export function readUint32(
  data: Uint8Array,
  offset: number,
  isLittleEndian: boolean,
): number {
  if (isLittleEndian) {
    return (
      (data[offset] ?? 0) |
      ((data[offset + 1] ?? 0) << 8) |
      ((data[offset + 2] ?? 0) << 16) |
      ((data[offset + 3] ?? 0) << 24)
    );
  }
  return (
    ((data[offset] ?? 0) << 24) |
    ((data[offset + 1] ?? 0) << 16) |
    ((data[offset + 2] ?? 0) << 8) |
    (data[offset + 3] ?? 0)
  );
}

/**
 * Compare two Uint8Arrays for equality
 *
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays have same length and all elements match
 */
export function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Write 2-byte unsigned integer with endianness support
 *
 * @param data - Byte array to write to
 * @param offset - Offset to start writing at
 * @param value - 16-bit unsigned integer value
 * @param isLittleEndian - If true, write as little-endian
 */
export function writeUint16(
  data: Uint8Array,
  offset: number,
  value: number,
  isLittleEndian: boolean,
): void {
  if (isLittleEndian) {
    data[offset] = value & 0xff;
    data[offset + 1] = (value >>> 8) & 0xff;
  } else {
    data[offset] = (value >>> 8) & 0xff;
    data[offset + 1] = value & 0xff;
  }
}

/**
 * Write 4-byte unsigned integer with endianness support
 *
 * @param data - Byte array to write to
 * @param offset - Offset to start writing at
 * @param value - 32-bit unsigned integer value
 * @param isLittleEndian - If true, write as little-endian
 */
export function writeUint32(
  data: Uint8Array,
  offset: number,
  value: number,
  isLittleEndian: boolean,
): void {
  if (isLittleEndian) {
    data[offset] = value & 0xff;
    data[offset + 1] = (value >>> 8) & 0xff;
    data[offset + 2] = (value >>> 16) & 0xff;
    data[offset + 3] = (value >>> 24) & 0xff;
  } else {
    data[offset] = (value >>> 24) & 0xff;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
  }
}

/**
 * Write 4-byte little-endian unsigned integer
 *
 * @param data - Byte array to write to
 * @param offset - Offset to start writing at
 * @param value - 32-bit unsigned integer value
 */
export function writeUint32LE(
  data: Uint8Array,
  offset: number,
  value: number,
): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

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
