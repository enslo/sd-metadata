/**
 * Random-access byte input for the video readers
 *
 * Video files are large and keep their metadata in a few small boxes or
 * elements, so the readers fetch byte ranges instead of the whole file.
 * Bytes already in memory are sliced; a Blob (a browser File, or Node's
 * `fs.openAsBlob()`) is read range by range.
 */

/** A file of known size whose bytes are read by range. */
export interface ByteSource {
  /** Total length in bytes */
  readonly size: number;
  /**
   * Read `length` bytes at `offset`. Returns fewer bytes when the range
   * runs past the end, and an empty array when `offset` is past it.
   */
  read(offset: number, length: number): Promise<Uint8Array>;
}

/**
 * Wrap video input as a {@link ByteSource}.
 *
 * @param input - Bytes, or a Blob read lazily
 */
export function toByteSource(
  input: Uint8Array | ArrayBuffer | Blob,
): ByteSource {
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return {
      size: input.size,
      read: async (offset, length) =>
        new Uint8Array(
          await input.slice(offset, offset + length).arrayBuffer(),
        ),
    };
  }
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer);
  return {
    size: bytes.length,
    read: async (offset, length) =>
      bytes.subarray(
        Math.min(offset, bytes.length),
        Math.min(offset + length, bytes.length),
      ),
  };
}
