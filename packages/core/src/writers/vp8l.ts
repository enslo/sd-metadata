/**
 * Rewriting a WebP lossless (VP8L) stream for edited pixels
 *
 * A VP8L encoder spends most of its work on choices: which transforms,
 * which backward references, how to group the prefix codes. For pixels
 * that differ from the original in a few low bits, all of those choices
 * still fit, so they are taken from the original stream instead of made
 * again:
 *
 * - the image header, the transforms, the color cache size and the
 *   entropy image are copied bit for bit;
 * - the edited pixels go through the same transforms, which gives the
 *   values the entropy coder sees;
 * - each backward reference of the original is kept where it still holds
 *   for those values, and spelled out pixel by pixel where it does not;
 * - the prefix codes are built again for the new symbol counts.
 *
 * The result decodes to exactly the edited pixels and stays about the
 * size of the original.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9649
 */

import {
  BitReader,
  type BlockTransform,
  blockCount,
  CACHE_BASE,
  CODE_LENGTH_ORDER,
  type ColorIndexingTransform,
  cacheKey,
  LITERAL_CODES,
  OPAQUE_BLACK,
  pixelDistance,
  predict,
  type Transform,
  type Vp8lLayout,
} from '../readers/vp8l';

const MAX_CODE_LENGTH = 15;
/** Code lengths are themselves coded with lengths of at most 7 bits */
const MAX_LENGTH_CODE_LENGTH = 7;
const DISTANCE_CODES = 40;

// ============================================================================
// Bit writer and prefix codes
// ============================================================================

class BitWriter {
  private buffer: Uint8Array;
  private length = 0;
  private pending = 0;
  private pendingBits = 0;

  constructor(capacity: number) {
    this.buffer = new Uint8Array(capacity);
  }

  /** Append the low `count` bits of `value` (at most 24), lowest bit first */
  write(value: number, count: number): void {
    this.pending |= value << this.pendingBits;
    this.pendingBits += count;
    while (this.pendingBits >= 8) {
      this.push(this.pending & 0xff);
      this.pending >>>= 8;
      this.pendingBits -= 8;
    }
  }

  private push(byte: number): void {
    if (this.length === this.buffer.length) {
      const grown = new Uint8Array(this.buffer.length * 2 + 1024);
      grown.set(this.buffer);
      this.buffer = grown;
    }
    this.buffer[this.length++] = byte;
  }

  /** The bytes written, the last one padded with zero bits */
  finish(): Uint8Array {
    if (this.pendingBits > 0) {
      this.push(this.pending & 0xff);
      this.pending = 0;
      this.pendingBits = 0;
    }
    return this.buffer.slice(0, this.length);
  }
}

/** A prefix code ready for writing */
interface WriteCode {
  /** Code length per symbol, 0 for a symbol that does not occur */
  lengths: Uint8Array;
  /** Canonical code per symbol, bit-reversed for a writer that goes lowest bit first */
  codes: Uint16Array;
  /** A code of at most one symbol: reading it takes no bits */
  silent: boolean;
}

function reverseBits(code: number, length: number): number {
  let reversed = 0;
  for (let i = 0; i < length; i++) {
    reversed = (reversed << 1) | ((code >> i) & 1);
  }
  return reversed;
}

/**
 * Huffman code lengths for a histogram, none longer than `limit`
 *
 * A plain Huffman tree is built; while it is deeper than the limit, the
 * smallest counts are raised and the tree built again, which flattens it.
 */
function buildLengths(histogram: Uint32Array, limit: number): Uint8Array {
  const lengths = new Uint8Array(histogram.length);
  const symbols: number[] = [];
  for (let symbol = 0; symbol < histogram.length; symbol++) {
    if ((histogram[symbol] ?? 0) > 0) symbols.push(symbol);
  }
  const [only] = symbols;
  if (only === undefined) {
    return lengths;
  }
  if (symbols.length === 1) {
    lengths[only] = 1;
    return lengths;
  }

  const count = symbols.length;
  for (let floor = 1; ; floor *= 2) {
    const leaves = symbols
      .map((symbol) => ({
        symbol,
        weight: Math.max(histogram[symbol] ?? 0, floor),
      }))
      .sort((a, b) => a.weight - b.weight || a.symbol - b.symbol);

    // Leaves first, then the inner nodes in the order they are made: both
    // runs are sorted by weight, so the two lightest nodes are always at
    // the head of one of them
    const weights = new Float64Array(2 * count - 1);
    const parents = new Int32Array(2 * count - 1);
    leaves.forEach((leaf, i) => {
      weights[i] = leaf.weight;
    });
    let leaf = 0;
    let inner = count;
    let next = count;
    const lightest = (): number =>
      leaf < count &&
      (inner >= next || (weights[leaf] ?? 0) <= (weights[inner] ?? 0))
        ? leaf++
        : inner++;
    while (next < 2 * count - 1) {
      const a = lightest();
      const b = lightest();
      weights[next] = (weights[a] ?? 0) + (weights[b] ?? 0);
      parents[a] = next;
      parents[b] = next;
      next++;
    }

    // A node's parent comes after it, so depths resolve from the root down
    const depths = new Uint16Array(2 * count - 1);
    let deepest = 0;
    for (let i = 2 * count - 3; i >= 0; i--) {
      const depth = (depths[parents[i] ?? 0] ?? 0) + 1;
      depths[i] = depth;
      if (i < count && depth > deepest) deepest = depth;
    }
    if (deepest <= limit) {
      leaves.forEach(({ symbol }, i) => {
        lengths[symbol] = depths[i] ?? 0;
      });
      return lengths;
    }
  }
}

function buildCode(histogram: Uint32Array, limit: number): WriteCode {
  const lengths = buildLengths(histogram, limit);
  const counts = new Uint16Array(MAX_CODE_LENGTH + 1);
  let used = 0;
  for (const length of lengths) {
    if (length > 0) {
      counts[length] = (counts[length] ?? 0) + 1;
      used++;
    }
  }
  // Canonical codes: by length, then by symbol
  const next = new Uint16Array(MAX_CODE_LENGTH + 1);
  for (let length = 1, code = 0; length <= MAX_CODE_LENGTH; length++) {
    code = (code + (counts[length - 1] ?? 0)) << 1;
    next[length] = code;
  }
  const codes = new Uint16Array(lengths.length);
  for (let symbol = 0; symbol < lengths.length; symbol++) {
    const length = lengths[symbol] ?? 0;
    if (length > 0) {
      const code = next[length] ?? 0;
      codes[symbol] = reverseBits(code, length);
      next[length] = code + 1;
    }
  }
  return { lengths, codes, silent: used <= 1 };
}

function writeSymbol(bw: BitWriter, code: WriteCode, symbol: number): void {
  if (!code.silent) {
    bw.write(code.codes[symbol] ?? 0, code.lengths[symbol] ?? 0);
  }
}

/** A code length (0-15) or a run (16, 17, 18) with its extra bits */
interface LengthToken {
  code: number;
  extraBits: number;
  extra: number;
}

/**
 * Run-length code a list of code lengths: 16 repeats the last non-zero
 * length 3-6 times, 17 and 18 are runs of 3-10 and 11-138 zeros
 */
function runLengthTokens(lengths: Uint8Array): LengthToken[] {
  const tokens: LengthToken[] = [];
  const literal = (code: number) => ({ code, extraBits: 0, extra: 0 });
  // What a 16 repeats before any length was seen
  let previous = 8;
  for (let i = 0; i < lengths.length; ) {
    const value = lengths[i] ?? 0;
    let run = 1;
    while (i + run < lengths.length && lengths[i + run] === value) run++;
    i += run;

    if (value === 0) {
      while (run >= 11) {
        const take = Math.min(run, 138);
        tokens.push({ code: 18, extraBits: 7, extra: take - 11 });
        run -= take;
      }
      if (run >= 3) {
        tokens.push({ code: 17, extraBits: 3, extra: run - 3 });
        run = 0;
      }
    } else {
      if (value !== previous) {
        tokens.push(literal(value));
        previous = value;
        run--;
      }
      while (run >= 3) {
        const take = Math.min(run, 6);
        tokens.push({ code: 16, extraBits: 2, extra: take - 3 });
        run -= take;
      }
    }
    while (run-- > 0) tokens.push(literal(value));
  }
  return tokens;
}

/**
 * Write a prefix code: one or two symbols below 256 directly, anything
 * else as run-length coded lengths
 */
function writePrefixCode(bw: BitWriter, code: WriteCode): void {
  const used: number[] = [];
  for (let symbol = 0; symbol < code.lengths.length; symbol++) {
    if ((code.lengths[symbol] ?? 0) > 0) used.push(symbol);
  }

  if (used.length <= 2 && used.every((symbol) => symbol < 256)) {
    // A code nothing is read with still has to name a symbol
    const [first = 0, second] = used;
    bw.write(1, 1);
    bw.write(second === undefined ? 0 : 1, 1);
    if (first < 2) {
      bw.write(0, 1);
      bw.write(first, 1);
    } else {
      bw.write(1, 1);
      bw.write(first, 8);
    }
    if (second !== undefined) bw.write(second, 8);
    return;
  }

  bw.write(0, 1);
  const tokens = runLengthTokens(code.lengths);
  const histogram = new Uint32Array(CODE_LENGTH_ORDER.length);
  for (const token of tokens) {
    histogram[token.code] = (histogram[token.code] ?? 0) + 1;
  }
  const lengthCode = buildCode(histogram, MAX_LENGTH_CODE_LENGTH);

  // Lengths of the length code, in their fixed order, without the
  // trailing zeros (at least four are stored)
  let stored = CODE_LENGTH_ORDER.length;
  while (
    stored > 4 &&
    lengthCode.lengths[CODE_LENGTH_ORDER[stored - 1] ?? 0] === 0
  ) {
    stored--;
  }
  bw.write(stored - 4, 4);
  for (let i = 0; i < stored; i++) {
    bw.write(lengthCode.lengths[CODE_LENGTH_ORDER[i] ?? 0] ?? 0, 3);
  }
  bw.write(0, 1); // every length is listed
  for (const token of tokens) {
    writeSymbol(bw, lengthCode, token.code);
    if (token.extraBits > 0) bw.write(token.extra, token.extraBits);
  }
}

/** A length or distance code as a prefix symbol with extra bits */
interface PrefixValue {
  symbol: number;
  extraBits: number;
  extra: number;
}

function prefixEncode(value: number): PrefixValue {
  const offset = value - 1;
  if (offset < 4) {
    return { symbol: offset, extraBits: 0, extra: 0 };
  }
  const highest = 31 - Math.clz32(offset);
  const extraBits = highest - 1;
  return {
    symbol: 2 * highest + ((offset >> extraBits) & 1),
    extraBits,
    extra: offset & ((1 << extraBits) - 1),
  };
}

// ============================================================================
// Forward transforms: pixels to what the entropy coder sees
// ============================================================================

/** Subtract two ARGB values channel by channel, each wrapping at 256 */
function subtractPixels(a: number, b: number): number {
  const alphaGreen = 0x00ff00ff + (a & 0xff00ff00) - (b & 0xff00ff00);
  const redBlue = 0xff00ff00 + (a & 0x00ff00ff) - (b & 0x00ff00ff);
  return ((alphaGreen & 0xff00ff00) | (redBlue & 0x00ff00ff)) >>> 0;
}

function forwardPredictor(
  px: Uint32Array,
  height: number,
  t: BlockTransform,
): Uint32Array {
  const { width, bits, blocks } = t;
  const out = new Uint32Array(px.length);
  const blocksPerRow = blockCount(width, bits);

  // The first row predicts from the left, the first column from above
  out[0] = subtractPixels(px[0] ?? 0, OPAQUE_BLACK);
  for (let x = 1; x < width; x++) {
    out[x] = subtractPixels(px[x] ?? 0, px[x - 1] ?? 0);
  }
  for (let y = 1; y < height; y++) {
    const row = y * width;
    out[row] = subtractPixels(px[row] ?? 0, px[row - width] ?? 0);
    const blockRow = (y >> bits) * blocksPerRow;
    for (let x = 1; x < width; x++) {
      const mode = ((blocks[blockRow + (x >> bits)] ?? 0) >>> 8) & 0xf;
      const pos = row + x;
      out[pos] = subtractPixels(px[pos] ?? 0, predict(px, pos, width, mode));
    }
  }
  return out;
}

function forwardColor(
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
      const signedRed = ((p >> 16) << 24) >> 24;
      const red = ((p >>> 16) - ((((m << 24) >> 24) * green) >> 5)) & 0xff;
      const blue =
        (p -
          ((((m << 16) >> 24) * green) >> 5) -
          ((((m << 8) >> 24) * signedRed) >> 5)) &
        0xff;
      px[pos] = ((p & 0xff00ff00) | (red << 16) | blue) >>> 0;
    }
  }
}

function forwardSubtractGreen(px: Uint32Array): void {
  for (let i = 0; i < px.length; i++) {
    const p = px[i] ?? 0;
    const green = (p >>> 8) & 0xff;
    px[i] =
      ((p & 0xff00ff00) |
        ((((p >>> 16) - green) & 0xff) << 16) |
        ((p - green) & 0xff)) >>>
      0;
  }
}

/**
 * @throws when a pixel has a color the table does not hold: the table is
 *   part of what is copied, so such pixels cannot be stored
 */
function forwardColorIndexing(
  px: Uint32Array,
  height: number,
  t: ColorIndexingTransform,
): Uint32Array {
  const { width, bits, table } = t;
  const indexes = new Map<number, number>();
  for (let i = table.length - 1; i >= 0; i--) {
    indexes.set(table[i] ?? 0, i);
  }
  const packedWidth = blockCount(width, bits);
  const out = new Uint32Array(packedWidth * height).fill(OPAQUE_BLACK);
  const bitsPerIndex = 8 >> bits;
  const packMask = (1 << bits) - 1;
  for (let y = 0, pos = 0; y < height; y++) {
    for (let x = 0; x < width; x++, pos++) {
      const index = indexes.get(px[pos] ?? 0);
      if (index === undefined) {
        throw new Error('VP8L: edited color is not in the color table');
      }
      const at = y * packedWidth + (x >> bits);
      out[at] =
        ((out[at] ?? 0) | (index << (8 + bitsPerIndex * (x & packMask)))) >>> 0;
    }
  }
  return out;
}

function forwardTransforms(
  pixels: Uint32Array,
  height: number,
  transforms: Transform[],
): Uint32Array {
  let px: Uint32Array = pixels.slice();
  for (const t of transforms) {
    switch (t.type) {
      case 'predictor':
        px = forwardPredictor(px, height, t);
        break;
      case 'color':
        forwardColor(px, height, t);
        break;
      case 'subtractGreen':
        forwardSubtractGreen(px);
        break;
      case 'colorIndexing':
        px = forwardColorIndexing(px, height, t);
        break;
    }
  }
  return px;
}

// ============================================================================
// Rewrite
// ============================================================================

/**
 * Store edited pixels in a VP8L stream the way the original stream stored
 * its own
 *
 * @param data - The original stream
 * @param layout - Its layout, from `decodeVp8l(data, { layout: true })`
 * @param height - Height of the image
 * @param pixels - The edited pixels (ARGB), in the image's dimensions
 * @returns A stream that decodes to `pixels`
 * @throws when the edited pixels do not fit a transform of the stream (a
 *   color missing from its color table)
 */
export function rewriteVp8l(
  data: Uint8Array,
  layout: Vp8lLayout,
  height: number,
  pixels: Uint32Array,
): Uint8Array {
  const { codedWidth: width, cacheBits, entropy, groupCount, tokens } = layout;
  const values = forwardTransforms(pixels, height, layout.transforms);
  const total = width * height;
  if (values.length !== total) {
    throw new Error('VP8L: pixel count does not match the stream');
  }

  /** Code group of the block a position falls in */
  const groupAt = (pos: number): number =>
    entropy
      ? (entropy.groups[
          (Math.floor(pos / width) >> entropy.bits) * entropy.width +
            ((pos % width) >> entropy.bits)
        ] ?? 0)
      : 0;

  // Symbol counts per code group: green (with lengths and cache indexes),
  // red, blue, alpha, distance
  const greenSize = CACHE_BASE + (cacheBits > 0 ? 1 << cacheBits : 0);
  const histograms: Uint32Array[][] = [];
  for (let i = 0; i < groupCount; i++) {
    histograms.push([
      new Uint32Array(greenSize),
      new Uint32Array(LITERAL_CODES),
      new Uint32Array(LITERAL_CODES),
      new Uint32Array(LITERAL_CODES),
      new Uint32Array(DISTANCE_CODES),
    ]);
  }
  const count = (group: number, code: number, symbol: number): void => {
    const histogram = histograms[group]?.[code];
    if (histogram) histogram[symbol] = (histogram[symbol] ?? 0) + 1;
  };

  // First pass: decide how each position is spelled, and count symbols.
  // 0 = literal, -1 - key = color cache hit, > 0 = backward reference of
  // that length with the distance code beside it.
  const spelled = new Int32Array(total);
  const distances = new Int32Array(total);
  let spelledCount = 0;
  const cache = cacheBits > 0 ? new Uint32Array(1 << cacheBits) : null;

  const spellPixel = (pos: number): void => {
    const argb = values[pos] ?? 0;
    const group = groupAt(pos);
    if (cache) {
      const key = cacheKey(argb, cacheBits);
      if (cache[key] === argb) {
        count(group, 0, CACHE_BASE + key);
        spelled[spelledCount++] = -1 - key;
        return;
      }
      cache[key] = argb;
    }
    count(group, 0, (argb >>> 8) & 0xff);
    count(group, 1, (argb >>> 16) & 0xff);
    count(group, 2, argb & 0xff);
    count(group, 3, argb >>> 24);
    spelled[spelledCount++] = 0;
  };

  for (let i = 0, pos = 0; i < tokens.count; i++) {
    const length = tokens.length[i] ?? 1;
    const distanceCode = tokens.distance[i] ?? 0;
    if (distanceCode === 0) {
      spellPixel(pos++);
      continue;
    }

    // A backward reference of the original: keep it if the pixels it
    // copies are still the pixels wanted here
    const distance = pixelDistance(distanceCode, width);
    let holds = 0;
    while (
      holds < length &&
      values[pos + holds] === values[pos + holds - distance]
    ) {
      holds++;
    }
    if (holds < length) {
      for (const end = pos + length; pos < end; pos++) {
        spellPixel(pos);
      }
      continue;
    }
    const group = groupAt(pos);
    count(group, 0, LITERAL_CODES + prefixEncode(length).symbol);
    count(group, 4, prefixEncode(distanceCode).symbol);
    spelled[spelledCount] = length;
    distances[spelledCount++] = distanceCode;
    if (cache) {
      for (let j = 0; j < length; j++) {
        const argb = values[pos + j] ?? 0;
        cache[cacheKey(argb, cacheBits)] = argb;
      }
    }
    pos += length;
  }

  // Everything up to the prefix codes holds as it is
  const bw = new BitWriter(data.length + 4096);
  const br = new BitReader(data);
  while (br.pos < layout.codesStart) {
    const bits = Math.min(16, layout.codesStart - br.pos);
    bw.write(br.read(bits), bits);
  }

  const codes = histograms.map((group) =>
    group.map((histogram) => {
      const code = buildCode(histogram, MAX_CODE_LENGTH);
      writePrefixCode(bw, code);
      return code;
    }),
  );

  // Second pass: write the symbols
  for (let i = 0, pos = 0; i < spelledCount; i++) {
    const [green, red, blue, alpha, distance] = codes[groupAt(pos)] ?? [];
    if (!green || !red || !blue || !alpha || !distance) {
      throw new Error('VP8L: code group out of range');
    }
    const how = spelled[i] ?? 0;
    if (how > 0) {
      const length = prefixEncode(how);
      writeSymbol(bw, green, LITERAL_CODES + length.symbol);
      bw.write(length.extra, length.extraBits);
      const back = prefixEncode(distances[i] ?? 0);
      writeSymbol(bw, distance, back.symbol);
      bw.write(back.extra, back.extraBits);
      pos += how;
    } else if (how < 0) {
      writeSymbol(bw, green, CACHE_BASE + (-1 - how));
      pos++;
    } else {
      const argb = values[pos++] ?? 0;
      writeSymbol(bw, green, (argb >>> 8) & 0xff);
      writeSymbol(bw, red, (argb >>> 16) & 0xff);
      writeSymbol(bw, blue, argb & 0xff);
      writeSymbol(bw, alpha, argb >>> 24);
    }
  }
  return bw.finish();
}

// ============================================================================
// Plain encoding
// ============================================================================

/** Longest backward reference a length prefix can express */
const MAX_REFERENCE_LENGTH = 4096;
/** Distance code of the pixel right before: (dx, dy) = (1, 0) */
const PREVIOUS_PIXEL = 2;

/**
 * Encode pixels as a VP8L stream of their own: no transforms, one code
 * group, literals, and runs of one color as references to the pixel
 * before
 *
 * The fallback for pixels rewriteVp8l cannot store, which means a picture
 * of few colors whose color table lacks an edited one. On such pictures
 * runs and short codes go a long way; on a photo this would be far from
 * what a real encoder achieves.
 *
 * @param pixels - ARGB values, `width * height` of them
 * @param header - Write the image header; false for the stream of an
 *   ALPH chunk, which has none
 */
export function encodeVp8l(
  width: number,
  height: number,
  pixels: Uint32Array,
  header = true,
): Uint8Array {
  const total = width * height;
  const histograms = [
    new Uint32Array(CACHE_BASE),
    new Uint32Array(LITERAL_CODES),
    new Uint32Array(LITERAL_CODES),
    new Uint32Array(LITERAL_CODES),
    new Uint32Array(DISTANCE_CODES),
  ];
  const count = (code: number, symbol: number): void => {
    const histogram = histograms[code];
    if (histogram) histogram[symbol] = (histogram[symbol] ?? 0) + 1;
  };

  // 0 = literal, > 0 = that many repeats of the pixel before
  const spelled = new Int32Array(total);
  let spelledCount = 0;
  let opaque = true;
  for (let pos = 0; pos < total; ) {
    const argb = pixels[pos] ?? 0;
    if (argb >>> 24 !== 0xff) opaque = false;
    let run = 0;
    if (pos > 0 && argb === pixels[pos - 1]) {
      run = 1;
      while (
        run < MAX_REFERENCE_LENGTH &&
        pos + run < total &&
        pixels[pos + run] === argb
      ) {
        run++;
      }
    }
    if (run > 0) {
      count(0, LITERAL_CODES + prefixEncode(run).symbol);
      count(4, prefixEncode(PREVIOUS_PIXEL).symbol);
      pos += run;
    } else {
      count(0, (argb >>> 8) & 0xff);
      count(1, (argb >>> 16) & 0xff);
      count(2, argb & 0xff);
      count(3, argb >>> 24);
      pos++;
    }
    spelled[spelledCount++] = run;
  }

  const bw = new BitWriter(1024 + (total >> 1));
  if (header) {
    bw.write(0x2f, 8);
    bw.write(width - 1, 14);
    bw.write(height - 1, 14);
    bw.write(opaque ? 0 : 1, 1);
    bw.write(0, 3); // version
  }
  bw.write(0, 1); // no transform
  bw.write(0, 1); // no color cache
  bw.write(0, 1); // one code group for the whole image

  const codes = histograms.map((histogram) => {
    const code = buildCode(histogram, MAX_CODE_LENGTH);
    writePrefixCode(bw, code);
    return code;
  });
  const [green, red, blue, alpha, distance] = codes;
  if (!green || !red || !blue || !alpha || !distance) {
    throw new Error('VP8L: missing prefix code');
  }

  for (let i = 0, pos = 0; i < spelledCount; i++) {
    const run = spelled[i] ?? 0;
    if (run > 0) {
      const length = prefixEncode(run);
      writeSymbol(bw, green, LITERAL_CODES + length.symbol);
      bw.write(length.extra, length.extraBits);
      const back = prefixEncode(PREVIOUS_PIXEL);
      writeSymbol(bw, distance, back.symbol);
      bw.write(back.extra, back.extraBits);
      pos += run;
    } else {
      const argb = pixels[pos++] ?? 0;
      writeSymbol(bw, green, (argb >>> 8) & 0xff);
      writeSymbol(bw, red, (argb >>> 16) & 0xff);
      writeSymbol(bw, blue, argb & 0xff);
      writeSymbol(bw, alpha, argb >>> 24);
    }
  }
  return bw.finish();
}
