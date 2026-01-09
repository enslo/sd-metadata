/**
 * Binary data utilities for reading/writing multi-byte integers
 */

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
