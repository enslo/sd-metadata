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
 * Bytes read from a Blob beyond what was asked for. The readers walk a
 * file box by box with a 16-byte header read each, and a fragmented MP4
 * (screen recordings, streams) has thousands of boxes: with a window, a
 * run of such reads costs one slice instead of one per box.
 */
const BLOB_READ_AHEAD = 64 * 1024;

/**
 * Wrap video input as a {@link ByteSource}.
 *
 * @param input - Bytes, or a Blob read lazily
 */
export function toByteSource(
  input: Uint8Array | ArrayBuffer | Blob,
): ByteSource {
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return blobByteSource(input);
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

/**
 * A Blob read range by range, keeping the last slice as a window that
 * later reads inside it are served from
 */
function blobByteSource(blob: Blob): ByteSource {
  let windowStart = 0;
  let window = new Uint8Array(0);
  return {
    size: blob.size,
    async read(offset, length) {
      const end = Math.min(offset + length, blob.size);
      if (offset >= end) {
        return new Uint8Array(0);
      }
      if (offset < windowStart || end > windowStart + window.length) {
        const windowEnd = Math.min(
          Math.max(end, offset + BLOB_READ_AHEAD),
          blob.size,
        );
        window = new Uint8Array(
          await blob.slice(offset, windowEnd).arrayBuffer(),
        );
        windowStart = offset;
      }
      return window.subarray(offset - windowStart, end - windowStart);
    },
  };
}
