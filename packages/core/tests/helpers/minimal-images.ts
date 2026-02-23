/**
 * Minimal test images for write target
 *
 * These functions create the smallest valid image containers
 * for each format. They contain no metadata and are ideal
 * for testing write operations without interference from
 * existing metadata.
 */

/**
 * Create a minimal valid JPEG structure for testing
 *
 * Structure: SOI + APP0 (JFIF) + SOS + minimal scan data + EOI
 * Size: ~53 bytes
 */
export function createMinimalJpeg(): Uint8Array {
  return new Uint8Array([
    // SOI
    0xff,
    0xd8,
    // APP0 (JFIF marker)
    0xff,
    0xe0,
    0x00,
    0x10, // Length: 16
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00, // "JFIF\0"
    0x01,
    0x01, // Version 1.1
    0x00, // No units
    0x00,
    0x01,
    0x00,
    0x01, // X/Y density: 1
    0x00,
    0x00, // No thumbnail
    // SOS (Start of Scan)
    0xff,
    0xda,
    0x00,
    0x08, // Length: 8
    0x01, // 1 component
    0x01,
    0x00, // Component ID, DC/AC tables
    0x00,
    0x3f,
    0x00, // Spectral selection, successive approximation
    // Minimal scan data (single DC coefficient)
    0xff,
    0x00, // Escaped 0xFF (valid JPEG data)
    // EOI
    0xff,
    0xd9,
  ]);
}

/**
 * Create a minimal valid PNG structure for testing
 *
 * Structure: PNG signature + IHDR (1x1 RGBA) + IEND
 * Size: 60 bytes
 */
export function createMinimalPng(): Uint8Array {
  return new Uint8Array([
    // Signature
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    // IHDR chunk (13 bytes data: width=1, height=1, bit depth=8, color type=6 RGBA)
    0x00,
    0x00,
    0x00,
    0x0d, // Length
    0x49,
    0x48,
    0x44,
    0x52, // "IHDR"
    0x00,
    0x00,
    0x00,
    0x01, // Width: 1
    0x00,
    0x00,
    0x00,
    0x01, // Height: 1
    0x08,
    0x06,
    0x00,
    0x00,
    0x00, // Bit depth, color type, compression, filter, interlace
    0x1f,
    0x15,
    0xc4,
    0x89, // CRC
    // IEND chunk
    0x00,
    0x00,
    0x00,
    0x00, // Length
    0x49,
    0x45,
    0x4e,
    0x44, // "IEND"
    0xae,
    0x42,
    0x60,
    0x82, // CRC
  ]);
}

/**
 * Create a minimal valid WebP structure for testing
 *
 * Structure: RIFF header + WEBP marker + VP8 chunk
 * Size: 40 bytes
 */
export function createMinimalWebp(): Uint8Array {
  return new Uint8Array([
    // RIFF header
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x14,
    0x00,
    0x00,
    0x00, // File size - 8
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
    // VP8 chunk (minimal)
    0x56,
    0x50,
    0x38,
    0x20, // "VP8 "
    0x08,
    0x00,
    0x00,
    0x00, // Chunk size
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // Placeholder data
  ]);
}
