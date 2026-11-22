/**
 * WebP lossless (VP8L) bitstream decoder
 *
 * Stealth PNGInfo lives in pixel least-significant bits, so a WebP can
 * only carry it where pixels are stored losslessly: in a VP8L image, or
 * in the alpha plane of a lossy image, which is VP8L-coded as well. This
 * decoder turns such a stream back into pixels in any runtime, with no
 * platform image decoder involved.
 *
 * A stream is bit-packed, least-significant bit first:
 *
 *   [header][transforms][color cache][entropy image][prefix codes][pixels]
 *
 * Pixels are entropy-coded as literals, backward references (LZ77) and
 * color cache hits. Up to four transforms (predictor, cross-color,
 * subtract-green, color indexing) were applied before coding and are
 * undone afterwards, last one first.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9649
 */

/** A decoded VP8L image */
export interface Vp8lImage {
  width: number;
  height: number;
  /** One ARGB value per pixel, row-major */
  pixels: Uint32Array;
  /** How the stream stored the image, when `options.layout` asked for it */
  layout?: Vp8lLayout;
}

/**
 * How a stream stored its image: what it takes to store edited pixels the
 * same way again (writers/vp8l.ts) without choosing transforms, a color
 * cache or backward references anew
 */
export interface Vp8lLayout {
  /**
   * Bit offset of the prefix codes. Everything before it (image header,
   * transforms, color cache size, entropy image) holds for edited pixels
   * as it is.
   */
  codesStart: number;
  /** Width the pixels are coded at: narrower under color indexing */
  codedWidth: number;
  /** Size of the color cache as a power of two, 0 for none */
  cacheBits: number;
  entropy: EntropyImage | null;
  groupCount: number;
  /** In the order the encoder applied them */
  transforms: Transform[];
  tokens: Vp8lTokens;
}

/** The sequence of symbols a stream spells its image with */
export interface Vp8lTokens {
  count: number;
  /** Pixels each token covers: 1 for a literal or a color cache hit */
  length: Int32Array;
  /** Distance code of a backward reference, 0 for a single pixel */
  distance: Int32Array;
}

export interface Vp8lOptions {
  /** Largest pixel count to decode; a larger image throws */
  maxPixels: number;
  /** Also return the {@link Vp8lLayout} of the stream */
  layout?: boolean;
  /**
   * Dimensions of a stream that has no image header of its own: the
   * alpha plane of a lossy WebP starts right at the transforms
   */
  size?: { width: number; height: number };
}

/** (dx, dy) pairs for the distance codes 1..120: the nearest neighbours */
const DISTANCE_MAP = new Int8Array([
  0, 1, 1, 0, 1, 1, -1, 1, 0, 2, 2, 0, 1, 2, -1, 2, 2, 1, -2, 1, 2, 2, -2, 2, 0,
  3, 3, 0, 1, 3, -1, 3, 3, 1, -3, 1, 2, 3, -2, 3, 3, 2, -3, 2, 0, 4, 4, 0, 1, 4,
  -1, 4, 4, 1, -4, 1, 3, 3, -3, 3, 2, 4, -2, 4, 4, 2, -4, 2, 0, 5, 3, 4, -3, 4,
  4, 3, -4, 3, 5, 0, 1, 5, -1, 5, 5, 1, -5, 1, 2, 5, -2, 5, 5, 2, -5, 2, 4, 4,
  -4, 4, 3, 5, -3, 5, 5, 3, -5, 3, 0, 6, 6, 0, 1, 6, -1, 6, 6, 1, -6, 1, 2, 6,
  -2, 6, 6, 2, -6, 2, 4, 5, -4, 5, 5, 4, -5, 4, 3, 6, -3, 6, 6, 3, -6, 3, 0, 7,
  7, 0, 1, 7, -1, 7, 5, 5, -5, 5, 7, 1, -7, 1, 4, 6, -4, 6, 6, 4, -6, 4, 2, 7,
  -2, 7, 7, 2, -7, 2, 3, 7, -3, 7, 7, 3, -7, 3, 5, 6, -5, 6, 6, 5, -6, 5, 8, 0,
  4, 7, -4, 7, 7, 4, -7, 4, 8, 1, 8, 2, 6, 6, -6, 6, 8, 3, 5, 7, -5, 7, 7, 5,
  -7, 5, 8, 4, 6, 7, -6, 7, 7, 6, -7, 6, 8, 5, 7, 7, -7, 7, 8, 6, 8, 7,
]);

/** Order in which the lengths of the code-length code are stored */
export const CODE_LENGTH_ORDER = [
  17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
];

const MAX_CODE_LENGTH = 15;
/** Codes up to this length resolve with one table lookup */
const ROOT_BITS = 8;

export const LITERAL_CODES = 256;
const LENGTH_CODES = 24;
const DISTANCE_CODES = 40;
/** First color cache symbol of the green alphabet */
export const CACHE_BASE = LITERAL_CODES + LENGTH_CODES;

export const OPAQUE_BLACK = 0xff000000;

/** Bit positions are kept in a 32-bit integer */
const MAX_STREAM_BYTES = 0x0fffffff;

const TRUNCATED = 'VP8L: truncated stream';

// ============================================================================
// Bit reader and prefix codes
// ============================================================================

export class BitReader {
  /** Position in bits from the start of the stream */
  pos = 0;

  constructor(private readonly data: Uint8Array) {}

  /**
   * The next `count` bits (at most 24) without consuming them. Bits past
   * the end read as zero; `exhausted` tells afterwards.
   */
  peek(count: number): number {
    const data = this.data;
    const byte = this.pos >> 3;
    const window =
      (data[byte] ?? 0) |
      ((data[byte + 1] ?? 0) << 8) |
      ((data[byte + 2] ?? 0) << 16) |
      ((data[byte + 3] ?? 0) << 24);
    return (window >>> (this.pos & 7)) & ((1 << count) - 1);
  }

  read(count: number): number {
    const value = this.peek(count);
    this.pos += count;
    return value;
  }

  /** Whether more bits were consumed than the stream holds */
  get exhausted(): boolean {
    return this.pos > this.data.length * 8;
  }
}

function reverseBits(code: number, length: number): number {
  let reversed = 0;
  for (let i = 0; i < length; i++) {
    reversed = (reversed << 1) | ((code >> i) & 1);
  }
  return reversed;
}

/**
 * A canonical prefix code, read most-significant code bit first
 */
class PrefixCode {
  /** The only symbol of a one-symbol code, which takes no bits; else -1 */
  private readonly single: number;
  /** Bits the lookup table is indexed by */
  private readonly rootBits: number;
  /** Lookup by the next stream bits: (code length << 16) | symbol, or -1 */
  private readonly table: Int32Array;
  /** Number of codes of each length */
  private readonly count: Uint16Array;
  /** Symbols ordered by code */
  private readonly sorted: Uint16Array;

  constructor(lengths: Uint8Array) {
    const count = new Uint16Array(MAX_CODE_LENGTH + 1);
    let used = 0;
    let last = 0;
    let longest = 0;
    for (let symbol = 0; symbol < lengths.length; symbol++) {
      const length = lengths[symbol] ?? 0;
      if (length > 0) {
        used++;
        last = symbol;
        count[length] = (count[length] ?? 0) + 1;
        if (length > longest) longest = length;
      }
    }
    if (used === 0) {
      throw new Error('VP8L: prefix code without symbols');
    }

    this.count = count;
    this.single = used === 1 ? last : -1;
    this.rootBits = Math.min(ROOT_BITS, longest);
    this.sorted = new Uint16Array(used);
    this.table = new Int32Array(used === 1 ? 0 : 1 << this.rootBits).fill(-1);
    if (used === 1) {
      return;
    }

    // The lengths must describe a full binary tree
    let open = 1;
    for (let length = 1; length <= MAX_CODE_LENGTH; length++) {
      open = open * 2 - (count[length] ?? 0);
      if (open < 0) break;
    }
    if (open !== 0) {
      throw new Error('VP8L: invalid prefix code lengths');
    }

    const offsets = new Uint16Array(MAX_CODE_LENGTH + 2);
    for (let length = 1; length <= MAX_CODE_LENGTH; length++) {
      offsets[length + 1] = (offsets[length] ?? 0) + (count[length] ?? 0);
    }
    for (let symbol = 0; symbol < lengths.length; symbol++) {
      const length = lengths[symbol] ?? 0;
      if (length > 0) {
        const slot = offsets[length] ?? 0;
        this.sorted[slot] = symbol;
        offsets[length] = slot + 1;
      }
    }

    // Short codes fill every table entry whose low bits spell the code
    const size = 1 << this.rootBits;
    let code = 0;
    let index = 0;
    for (let length = 1; length <= this.rootBits; length++) {
      for (let i = 0; i < (count[length] ?? 0); i++, code++) {
        const entry = (length << 16) | (this.sorted[index++] ?? 0);
        const step = 1 << length;
        for (let slot = reverseBits(code, length); slot < size; slot += step) {
          this.table[slot] = entry;
        }
      }
      code <<= 1;
    }
  }

  read(br: BitReader): number {
    if (this.single >= 0) {
      return this.single;
    }
    const entry = this.table[br.peek(this.rootBits)] ?? -1;
    if (entry >= 0) {
      br.pos += entry >> 16;
      return entry & 0xffff;
    }

    // A longer code: walk the canonical code one bit at a time
    let code = 0;
    let first = 0;
    let index = 0;
    for (let length = 1; length <= MAX_CODE_LENGTH; length++) {
      code |= br.read(1);
      const codes = this.count[length] ?? 0;
      if (code - codes < first) {
        return this.sorted[index + (code - first)] ?? 0;
      }
      index += codes;
      first = (first + codes) << 1;
      code <<= 1;
    }
    throw new Error('VP8L: invalid prefix code');
  }
}

/**
 * Read one prefix code: either one or two symbols given directly, or
 * code lengths that are themselves prefix-coded with run lengths
 */
function readPrefixCode(br: BitReader, alphabetSize: number): PrefixCode {
  const lengths = new Uint8Array(alphabetSize);

  if (br.read(1) === 1) {
    const symbols = br.read(1) + 1;
    const first = br.read(br.read(1) === 1 ? 8 : 1);
    const second = symbols === 2 ? br.read(8) : first;
    if (first >= alphabetSize || second >= alphabetSize) {
      throw new Error('VP8L: prefix code symbol out of range');
    }
    lengths[first] = 1;
    lengths[second] = 1;
    return new PrefixCode(lengths);
  }

  const lengthCodeLengths = new Uint8Array(CODE_LENGTH_ORDER.length);
  const stored = br.read(4) + 4;
  for (let i = 0; i < stored; i++) {
    lengthCodeLengths[CODE_LENGTH_ORDER[i] ?? 0] = br.read(3);
  }
  const lengthCode = new PrefixCode(lengthCodeLengths);

  // Optionally only the first few code lengths are stored
  let tokens = alphabetSize;
  if (br.read(1) === 1) {
    tokens = 2 + br.read(2 + 2 * br.read(3));
    if (tokens > alphabetSize) {
      throw new Error('VP8L: too many code lengths');
    }
  }

  let previous = 8;
  let symbol = 0;
  while (symbol < alphabetSize && tokens-- > 0) {
    const length = lengthCode.read(br);
    if (length < 16) {
      lengths[symbol++] = length;
      if (length !== 0) previous = length;
      continue;
    }
    // 16 repeats the last non-zero length, 17 and 18 are runs of zeros
    const repeat =
      length === 16
        ? 3 + br.read(2)
        : length === 17
          ? 3 + br.read(3)
          : 11 + br.read(7);
    if (symbol + repeat > alphabetSize) {
      throw new Error('VP8L: code length run past the alphabet');
    }
    if (length === 16) {
      lengths.fill(previous, symbol, symbol + repeat);
    }
    symbol += repeat;
  }
  return new PrefixCode(lengths);
}

/** The five prefix codes one block of pixels is coded with */
interface CodeGroup {
  /** Green, plus backward-reference lengths and color cache indexes */
  green: PrefixCode;
  red: PrefixCode;
  blue: PrefixCode;
  alpha: PrefixCode;
  distance: PrefixCode;
}

function readCodeGroup(br: BitReader, cacheBits: number): CodeGroup {
  const cacheSize = cacheBits > 0 ? 1 << cacheBits : 0;
  return {
    green: readPrefixCode(br, CACHE_BASE + cacheSize),
    red: readPrefixCode(br, LITERAL_CODES),
    blue: readPrefixCode(br, LITERAL_CODES),
    alpha: readPrefixCode(br, LITERAL_CODES),
    distance: readPrefixCode(br, DISTANCE_CODES),
  };
}

// ============================================================================
// Entropy-coded pixels
// ============================================================================

/** Which code group each block of the main image uses */
export interface EntropyImage {
  /** Blocks are (1 << bits) pixels square */
  bits: number;
  /** Blocks per row */
  width: number;
  /** Code group index per block */
  groups: Uint32Array;
}

/** Size in blocks of (1 << bits) pixels, rounded up */
export function blockCount(size: number, bits: number): number {
  return (size + (1 << bits) - 1) >> bits;
}

/** Value of a length or distance prefix symbol with its extra bits */
function prefixValue(br: BitReader, symbol: number): number {
  if (symbol < 4) {
    return symbol + 1;
  }
  const extraBits = (symbol - 2) >> 1;
  return ((2 + (symbol & 1)) << extraBits) + br.read(extraBits) + 1;
}

/** Distance in pixels of a distance code: the first 120 name neighbours */
export function pixelDistance(code: number, width: number): number {
  if (code > 120) {
    return code - 120;
  }
  const i = (code - 1) * 2;
  const distance = (DISTANCE_MAP[i] ?? 0) + (DISTANCE_MAP[i + 1] ?? 0) * width;
  return Math.max(distance, 1);
}

export function cacheKey(argb: number, cacheBits: number): number {
  return Math.imul(argb, 0x1e35a7bd) >>> (32 - cacheBits);
}

function readCacheBits(br: BitReader): number {
  if (br.read(1) === 0) {
    return 0;
  }
  const bits = br.read(4);
  if (bits < 1 || bits > 11) {
    throw new Error('VP8L: invalid color cache size');
  }
  return bits;
}

function groupAt(
  groups: CodeGroup[],
  entropy: EntropyImage | null,
  x: number,
  y: number,
): CodeGroup {
  const index = entropy
    ? (entropy.groups[
        (y >> entropy.bits) * entropy.width + (x >> entropy.bits)
      ] ?? 0)
    : 0;
  const group = groups[index];
  if (!group) {
    throw new Error('VP8L: code group out of range');
  }
  return group;
}

/**
 * Read `width * height` entropy-coded ARGB values
 */
function readPixels(
  br: BitReader,
  width: number,
  height: number,
  groups: CodeGroup[],
  entropy: EntropyImage | null,
  cacheBits: number,
  tokens: Vp8lTokens | null,
): Uint32Array {
  const total = width * height;
  const out = new Uint32Array(total);
  const cache = cacheBits > 0 ? new Uint32Array(1 << cacheBits) : null;
  const blockMask = entropy ? (1 << entropy.bits) - 1 : 0;
  let group = groupAt(groups, entropy, 0, 0);
  let pos = 0;
  let x = 0;
  let y = 0;
  // A stream that ends early reads as zeros: notice before decoding a
  // whole image out of nothing
  let nextCheck = 0;

  while (pos < total) {
    if (pos >= nextCheck) {
      if (br.exhausted) throw new Error(TRUNCATED);
      nextCheck = pos + 4096;
    }
    if (entropy && (x & blockMask) === 0) {
      group = groupAt(groups, entropy, x, y);
    }

    const green = group.green.read(br);
    if (green < LITERAL_CODES || green >= CACHE_BASE) {
      let argb: number;
      if (green < LITERAL_CODES) {
        const red = group.red.read(br);
        const blue = group.blue.read(br);
        const alpha = group.alpha.read(br);
        argb = ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
        if (cache) cache[cacheKey(argb, cacheBits)] = argb;
      } else {
        const cached = cache?.[green - CACHE_BASE];
        if (cached === undefined) {
          throw new Error('VP8L: color cache index out of range');
        }
        argb = cached;
      }
      out[pos++] = argb;
      if (tokens) {
        tokens.length[tokens.count] = 1;
        tokens.distance[tokens.count++] = 0;
      }
      if (++x === width) {
        x = 0;
        y++;
      }
      continue;
    }

    // Backward reference: copy `length` pixels from `distance` back
    const length = prefixValue(br, green - LITERAL_CODES);
    const distanceCode = prefixValue(br, group.distance.read(br));
    const distance = pixelDistance(distanceCode, width);
    if (distance > pos || pos + length > total) {
      throw new Error('VP8L: backward reference out of range');
    }
    for (const end = pos + length; pos < end; pos++) {
      const argb = out[pos - distance] ?? 0;
      out[pos] = argb;
      if (cache) cache[cacheKey(argb, cacheBits)] = argb;
    }
    if (tokens) {
      tokens.length[tokens.count] = length;
      tokens.distance[tokens.count++] = distanceCode;
    }
    x += length;
    while (x >= width) {
      x -= width;
      y++;
    }
    if (entropy && (x & blockMask) !== 0 && pos < total) {
      group = groupAt(groups, entropy, x, y);
    }
  }

  if (br.exhausted) throw new Error(TRUNCATED);
  return out;
}

/**
 * Read a sub-image (transform data, entropy image, color table): the
 * same coding as the main image, with a single code group
 */
function readSubImage(
  br: BitReader,
  width: number,
  height: number,
): Uint32Array {
  const cacheBits = readCacheBits(br);
  const groups = [readCodeGroup(br, cacheBits)];
  return readPixels(br, width, height, groups, null, cacheBits, null);
}

// ============================================================================
// Transforms
// ============================================================================

/** Predictor and cross-color transforms: one parameter value per block */
export interface BlockTransform {
  type: 'predictor' | 'color';
  /** Image width when the transform was applied */
  width: number;
  /** Blocks are (1 << bits) pixels square */
  bits: number;
  /** One value per block */
  blocks: Uint32Array;
}

export interface ColorIndexingTransform {
  type: 'colorIndexing';
  /** Image width before indexes were packed */
  width: number;
  /** (1 << bits) indexes share one pixel */
  bits: number;
  table: Uint32Array;
}

export type Transform =
  | BlockTransform
  | { type: 'subtractGreen' }
  | ColorIndexingTransform;

/** Add two ARGB values channel by channel, each wrapping at 256 */
function addPixels(a: number, b: number): number {
  const alphaGreen = (a & 0xff00ff00) + (b & 0xff00ff00);
  const redBlue = (a & 0x00ff00ff) + (b & 0x00ff00ff);
  return ((alphaGreen & 0xff00ff00) | (redBlue & 0x00ff00ff)) >>> 0;
}

/** Channel-wise average of two ARGB values, rounded down */
function average2(a: number, b: number): number {
  return ((((a ^ b) & 0xfefefefe) >>> 1) + ((a & b) >>> 0)) >>> 0;
}

function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value));
}

/** Whichever of left and top is closer to the gradient left + top - topLeft */
function select(left: number, top: number, topLeft: number): number {
  let score = 0;
  for (let shift = 0; shift < 32; shift += 8) {
    const corner = (topLeft >>> shift) & 0xff;
    score +=
      Math.abs(((left >>> shift) & 0xff) - corner) -
      Math.abs(((top >>> shift) & 0xff) - corner);
  }
  return score <= 0 ? top : left;
}

function clampAddSubtractFull(a: number, b: number, c: number): number {
  let out = 0;
  for (let shift = 0; shift < 32; shift += 8) {
    const value =
      ((a >>> shift) & 0xff) + ((b >>> shift) & 0xff) - ((c >>> shift) & 0xff);
    out |= clamp255(value) << shift;
  }
  return out >>> 0;
}

function clampAddSubtractHalf(a: number, b: number): number {
  let out = 0;
  for (let shift = 0; shift < 32; shift += 8) {
    const va = (a >>> shift) & 0xff;
    const vb = (b >>> shift) & 0xff;
    out |= clamp255(va + Math.trunc((va - vb) / 2)) << shift;
  }
  return out >>> 0;
}

/**
 * Predicted value of the pixel at `pos` from its decoded neighbours, for
 * a pixel that has both a row above and a pixel to its left
 *
 * The top-right neighbour of the last column is the first pixel of the
 * current row: simply the next one in memory.
 */
export function predict(
  px: Uint32Array,
  pos: number,
  width: number,
  mode: number,
): number {
  const left = px[pos - 1] ?? 0;
  const top = px[pos - width] ?? 0;
  switch (mode) {
    case 1:
      return left;
    case 2:
      return top;
    case 3:
      return px[pos - width + 1] ?? 0;
    case 4:
      return px[pos - width - 1] ?? 0;
    case 5:
      return average2(average2(left, px[pos - width + 1] ?? 0), top);
    case 6:
      return average2(left, px[pos - width - 1] ?? 0);
    case 7:
      return average2(left, top);
    case 8:
      return average2(px[pos - width - 1] ?? 0, top);
    case 9:
      return average2(top, px[pos - width + 1] ?? 0);
    case 10:
      return average2(
        average2(left, px[pos - width - 1] ?? 0),
        average2(top, px[pos - width + 1] ?? 0),
      );
    case 11:
      return select(left, top, px[pos - width - 1] ?? 0);
    case 12:
      return clampAddSubtractFull(left, top, px[pos - width - 1] ?? 0);
    case 13:
      return clampAddSubtractHalf(
        average2(left, top),
        px[pos - width - 1] ?? 0,
      );
    default:
      return OPAQUE_BLACK;
  }
}

/**
 * Undo the predictor transform in place: each pixel holds the difference
 * from a prediction chosen per block
 */
function inversePredictor(
  px: Uint32Array,
  height: number,
  t: BlockTransform,
): void {
  const { width, bits, blocks } = t;
  const blocksPerRow = blockCount(width, bits);

  // The first row predicts from the left, the first column from above
  px[0] = addPixels(px[0] ?? 0, OPAQUE_BLACK);
  for (let x = 1; x < width; x++) {
    px[x] = addPixels(px[x] ?? 0, px[x - 1] ?? 0);
  }
  for (let y = 1; y < height; y++) {
    const row = y * width;
    px[row] = addPixels(px[row] ?? 0, px[row - width] ?? 0);
    const blockRow = (y >> bits) * blocksPerRow;
    for (let x = 1; x < width; x++) {
      const mode = ((blocks[blockRow + (x >> bits)] ?? 0) >>> 8) & 0xf;
      const pos = row + x;
      px[pos] = addPixels(px[pos] ?? 0, predict(px, pos, width, mode));
    }
  }
}

/**
 * Undo the cross-color transform in place: red and blue hold what is
 * left after subtracting a per-block multiple of green (and of red)
 */
function inverseColor(
  px: Uint32Array,
  height: number,
  t: BlockTransform,
): void {
  const { width, bits, blocks } = t;
  const blocksPerRow = blockCount(width, bits);
  for (let y = 0, pos = 0; y < height; y++) {
    const blockRow = (y >> bits) * blocksPerRow;
    for (let x = 0; x < width; x++, pos++) {
      // Multipliers are signed bytes: green-to-red in the low byte, then
      // green-to-blue, then red-to-blue
      const m = blocks[blockRow + (x >> bits)] ?? 0;
      const p = px[pos] ?? 0;
      const green = ((p >> 8) << 24) >> 24;
      const red = ((p >>> 16) + ((((m << 24) >> 24) * green) >> 5)) & 0xff;
      let blue = (p + ((((m << 16) >> 24) * green) >> 5)) & 0xff;
      blue = (blue + ((((m << 8) >> 24) * ((red << 24) >> 24)) >> 5)) & 0xff;
      px[pos] = ((p & 0xff00ff00) | (red << 16) | blue) >>> 0;
    }
  }
}

/** Undo subtract-green in place: add green back to red and blue */
function inverseSubtractGreen(px: Uint32Array): void {
  for (let i = 0; i < px.length; i++) {
    const p = px[i] ?? 0;
    const green = (p >>> 8) & 0xff;
    px[i] =
      ((p & 0xff00ff00) |
        ((((p >>> 16) + green) & 0xff) << 16) |
        ((p + green) & 0xff)) >>>
      0;
  }
}

/**
 * Undo color indexing: the green channel holds indexes into a color
 * table, several of them packed into one value for small tables
 */
function inverseColorIndexing(
  px: Uint32Array,
  height: number,
  t: ColorIndexingTransform,
): Uint32Array {
  const { width, bits, table } = t;
  const out = new Uint32Array(width * height);
  const packedWidth = blockCount(width, bits);
  const bitsPerIndex = 8 >> bits;
  const packMask = (1 << bits) - 1;
  const indexMask = (1 << bitsPerIndex) - 1;
  for (let y = 0, pos = 0; y < height; y++) {
    let packed = 0;
    for (let x = 0; x < width; x++, pos++) {
      if ((x & packMask) === 0) {
        packed = ((px[y * packedWidth + (x >> bits)] ?? 0) >>> 8) & 0xff;
      }
      // An index past the table reads as transparent black
      out[pos] = table[packed & indexMask] ?? 0;
      packed >>= bitsPerIndex;
    }
  }
  return out;
}

// ============================================================================
// Image stream
// ============================================================================

/**
 * Decode a VP8L stream into ARGB pixels
 *
 * @param data - Payload of a VP8L chunk, or the stream of an ALPH chunk
 *   (with `options.size`)
 * @throws if the stream is malformed, truncated, or larger than
 *   `options.maxPixels`
 */
export function decodeVp8l(data: Uint8Array, options: Vp8lOptions): Vp8lImage {
  if (data.length > MAX_STREAM_BYTES) {
    throw new Error('VP8L: stream too large');
  }
  const br = new BitReader(data);

  let width: number;
  let height: number;
  if (options.size) {
    ({ width, height } = options.size);
  } else {
    if (br.read(8) !== 0x2f) {
      throw new Error('VP8L: invalid signature');
    }
    width = br.read(14) + 1;
    height = br.read(14) + 1;
    br.read(1); // alpha_is_used: a hint, alpha is decoded either way
    if (br.read(3) !== 0) {
      throw new Error('VP8L: unsupported version');
    }
  }
  if (!(width >= 1 && height >= 1 && width * height <= options.maxPixels)) {
    throw new Error('VP8L: image size out of range');
  }

  // Transforms, in the order the encoder applied them. Color indexing
  // narrows the image for everything that follows it.
  const transforms: Transform[] = [];
  const seen = new Set<number>();
  let codedWidth = width;
  while (br.read(1) === 1) {
    const kind = br.read(2);
    if (seen.has(kind)) {
      throw new Error('VP8L: transform used twice');
    }
    seen.add(kind);

    if (kind === 0 || kind === 1) {
      const bits = br.read(3) + 2;
      const blocks = readSubImage(
        br,
        blockCount(codedWidth, bits),
        blockCount(height, bits),
      );
      transforms.push({
        type: kind === 0 ? 'predictor' : 'color',
        width: codedWidth,
        bits,
        blocks,
      });
    } else if (kind === 2) {
      transforms.push({ type: 'subtractGreen' });
    } else {
      const colors = br.read(8) + 1;
      const bits = colors > 16 ? 0 : colors > 4 ? 1 : colors > 2 ? 2 : 3;
      // The table is stored as differences between neighbouring entries
      const table = readSubImage(br, colors, 1);
      for (let i = 1; i < colors; i++) {
        table[i] = addPixels(table[i] ?? 0, table[i - 1] ?? 0);
      }
      transforms.push({
        type: 'colorIndexing',
        width: codedWidth,
        bits,
        table,
      });
      codedWidth = blockCount(codedWidth, bits);
    }
  }

  // Main image: color cache, entropy image, code groups, pixels
  const cacheBits = readCacheBits(br);
  let entropy: EntropyImage | null = null;
  let groupCount = 1;
  if (br.read(1) === 1) {
    const bits = br.read(3) + 2;
    const blocksPerRow = blockCount(codedWidth, bits);
    const groups = readSubImage(br, blocksPerRow, blockCount(height, bits));
    for (let i = 0; i < groups.length; i++) {
      // The group index sits in the red and green channels
      const index = ((groups[i] ?? 0) >>> 8) & 0xffff;
      groups[i] = index;
      if (index >= groupCount) groupCount = index + 1;
    }
    entropy = { bits, width: blocksPerRow, groups };
  }
  const codesStart = br.pos;
  const groups: CodeGroup[] = [];
  for (let i = 0; i < groupCount; i++) {
    groups.push(readCodeGroup(br, cacheBits));
  }

  const tokens: Vp8lTokens | null = options.layout
    ? {
        count: 0,
        length: new Int32Array(codedWidth * height),
        distance: new Int32Array(codedWidth * height),
      }
    : null;
  let pixels = readPixels(
    br,
    codedWidth,
    height,
    groups,
    entropy,
    cacheBits,
    tokens,
  );
  for (let i = transforms.length - 1; i >= 0; i--) {
    const t = transforms[i];
    if (!t) continue;
    switch (t.type) {
      case 'predictor':
        inversePredictor(pixels, height, t);
        break;
      case 'color':
        inverseColor(pixels, height, t);
        break;
      case 'subtractGreen':
        inverseSubtractGreen(pixels);
        break;
      case 'colorIndexing':
        pixels = inverseColorIndexing(pixels, height, t);
        break;
    }
  }

  if (!tokens) {
    return { width, height, pixels };
  }
  return {
    width,
    height,
    pixels,
    layout: {
      codesStart,
      codedWidth,
      cacheBits,
      entropy,
      groupCount,
      transforms,
      tokens,
    },
  };
}
