/**
 * Video container reading
 *
 * Dispatches to the MP4 (ISO BMFF) and Matroska readers, which return the
 * same shape: text tags, video track dimensions, and the vendor payloads
 * (C2PA manifest store, XMP packet) the container carries.
 */

import type { ByteSource } from './byte-source';
import { readMatroska } from './matroska';
import { readMp4 } from './mp4';
import type { VideoContainer } from './video-container';

/**
 * Read a video container, or return `null` when the input is neither
 * ISO BMFF nor Matroska.
 */
export async function readVideoContainer(
  source: ByteSource,
): Promise<VideoContainer | null> {
  return (await readMp4(source)) ?? (await readMatroska(source));
}

/**
 * Whether bytes start like a video file (an ISO BMFF `ftyp` box or an EBML
 * header), so image APIs can point callers to parseVideo().
 */
export function isVideoSignature(data: Uint8Array): boolean {
  const ftyp =
    data[4] === 0x66 &&
    data[5] === 0x74 &&
    data[6] === 0x79 &&
    data[7] === 0x70;
  const ebml =
    data[0] === 0x1a &&
    data[1] === 0x45 &&
    data[2] === 0xdf &&
    data[3] === 0xa3;
  return ftyp || ebml;
}
