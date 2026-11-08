/**
 * Decompression helpers built on the Web Streams API
 *
 * Uses DecompressionStream, available in Node.js 18+ and all modern
 * browsers, so the library stays dependency-free. Every call states how
 * much output it is prepared to take: a deflate stream expands up to about
 * a thousandfold, so a few hundred kilobytes of input could otherwise
 * claim gigabytes of memory.
 */

/**
 * Decompress data with the given compression format
 *
 * The output is counted as it streams and the stream is cancelled once it
 * passes `maxBytes`, so no more than that (plus one chunk) is ever held.
 *
 * @throws if the data is not a valid stream, or when the output would
 *   exceed `maxBytes`
 */
async function decompress(
  data: Uint8Array,
  format: 'deflate' | 'gzip',
  maxBytes: number,
): Promise<Uint8Array> {
  let total = 0;
  const limit = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        controller.error(
          new RangeError(`Decompressed data exceeds ${maxBytes} bytes`),
        );
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream(format))
    .pipeThrough(limit);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decompress a zlib (RFC 1950) stream, e.g. PNG IDAT data
 *
 * @param maxBytes - Largest output accepted
 * @throws if the data is not a valid zlib stream, or inflates past `maxBytes`
 */
export function inflate(
  data: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array> {
  return decompress(data, 'deflate', maxBytes);
}

/**
 * Decompress a gzip (RFC 1952) stream
 *
 * @param maxBytes - Largest output accepted
 * @throws if the data is not a valid gzip stream, or inflates past `maxBytes`
 */
export function gunzip(
  data: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array> {
  return decompress(data, 'gzip', maxBytes);
}
