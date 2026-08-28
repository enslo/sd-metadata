/**
 * Decompression helpers built on the Web Streams API
 *
 * Uses DecompressionStream, available in Node.js 18+ and all modern
 * browsers, so the library stays dependency-free.
 */

/**
 * Decompress data with the given compression format
 */
async function decompress(
  data: Uint8Array,
  format: 'deflate' | 'gzip',
): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decompress a zlib (RFC 1950) stream, e.g. PNG IDAT data
 *
 * @throws if the data is not a valid zlib stream
 */
export function inflate(data: Uint8Array): Promise<Uint8Array> {
  return decompress(data, 'deflate');
}

/**
 * Decompress a gzip (RFC 1952) stream
 *
 * @throws if the data is not a valid gzip stream
 */
export function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return decompress(data, 'gzip');
}
