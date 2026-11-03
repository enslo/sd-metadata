/**
 * Minimal YAML reader for block mappings of scalars
 *
 * Covers what metadata writers emit (Dezgo's EXIF UserComment): nested
 * `key: value` mappings whose values are plain, single-quoted,
 * double-quoted or block (`|`, `>`) scalars, including scalars wrapped
 * over several lines. Sequences, flow collections, anchors, tags and
 * comments are outside its scope.
 */

/** Mapping of scalar values (as text) and nested mappings */
export interface YamlMapping {
  [key: string]: string | YamlMapping;
}

/** A `key:` line with its indentation and the text after the colon */
const KEY_LINE = /^( *)([^\s'"#][^:]*?):(?: +(.*))?$/;

/** Block scalar header: style, chomping indicator */
const BLOCK_HEADER = /^([|>])([+-]?)$/;

/**
 * Read a YAML document made of block mappings
 *
 * @param text - YAML text
 * @returns The top-level mapping, or undefined when the text is not one
 */
export function parseYamlMapping(text: string): YamlMapping | undefined {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() !== '');
  if (start < 0) return undefined;
  const result = readMapping(lines, start, 0);
  return result && Object.keys(result.mapping).length > 0
    ? result.mapping
    : undefined;
}

/**
 * Read the mapping whose keys sit at `indent`, starting at line `start`
 *
 * @returns The mapping and the index of the first line after it
 */
function readMapping(
  lines: string[],
  start: number,
  indent: number,
): { mapping: YamlMapping; end: number } | undefined {
  const mapping: YamlMapping = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
      continue;
    }
    const match = KEY_LINE.exec(line);
    const keyIndent = match?.[1]?.length ?? 0;
    if (!match || keyIndent < indent) break;
    if (keyIndent > indent) return undefined;

    const key = match[2] ?? '';
    const head = (match[3] ?? '').trim();
    // Value lines: everything below the key that is blank or deeper
    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end] ?? '';
      if (next.trim() !== '' && indentOf(next) <= indent) break;
      end++;
    }
    const body = lines.slice(i + 1, end);

    const firstBody = body.find((l) => l.trim() !== '');
    if (head === '' && firstBody !== undefined && KEY_LINE.test(firstBody)) {
      const nested = readMapping(lines, i + 1, indentOf(firstBody));
      if (!nested) return undefined;
      mapping[key] = nested.mapping;
      i = nested.end;
    } else {
      mapping[key] = readScalar(head, body);
      i = end;
    }
  }
  return { mapping, end: i };
}

/**
 * Read a scalar from the text after its key and the lines below it
 */
function readScalar(head: string, body: string[]): string {
  const block = BLOCK_HEADER.exec(head);
  if (block) {
    return readBlockScalar(block[1] === '>', block[2] ?? '', body);
  }

  // Blank lines before the next key end the value; they are not part of it
  const lines = [head, ...body];
  while (lines.length > 1 && (lines.at(-1) ?? '').trim() === '') lines.pop();
  const quote = head[0];
  if (quote === "'" || quote === '"') {
    const text = lines.join('\n');
    const close = findClosingQuote(text, quote);
    const inner = text.slice(1, close < 0 ? undefined : close);
    const folded = foldFlowLines(inner.split('\n'), quote === '"');
    return quote === "'"
      ? folded.replace(/''/g, "'")
      : unescapeDoubleQuoted(folded);
  }

  return foldFlowLines(lines, false);
}

/**
 * Index of the quote that closes a quoted scalar starting at index 0
 *
 * Single quotes escape themselves (`''`); double quotes use backslashes.
 */
function findClosingQuote(text: string, quote: string): number {
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (quote === '"' && char === '\\') {
      i++;
    } else if (char === quote) {
      if (quote === "'" && text[i + 1] === "'") {
        i++;
      } else {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Join the lines of a plain or quoted scalar
 *
 * Line breaks fold into a space, and each empty line in between stands for
 * one newline. Whitespace around the breaks is dropped. In double-quoted
 * scalars a backslash at the end of a line joins it to the next one with
 * nothing in between.
 */
function foldFlowLines(lines: string[], doubleQuoted: boolean): string {
  let result = '';
  let emptyLines = 0;
  let joinNext = false;
  let started = false;
  lines.forEach((raw, index) => {
    let line = raw;
    if (index > 0) line = line.replace(/^[ \t]+/, '');
    if (index < lines.length - 1) line = line.replace(/[ \t]+$/, '');

    if (line === '' && index > 0 && index < lines.length - 1) {
      emptyLines++;
      return;
    }
    if (started) {
      if (emptyLines > 0) result += '\n'.repeat(emptyLines);
      else if (!joinNext) result += ' ';
    }
    joinNext = doubleQuoted && /(^|[^\\])(\\\\)*\\$/.test(line);
    result += joinNext ? line.slice(0, -1) : line;
    started = true;
    emptyLines = 0;
  });
  return result;
}

/**
 * Read a literal (`|`) or folded (`>`) block scalar
 *
 * @param folded - True for `>`: line breaks between lines of text fold
 *   into spaces, except around more-indented lines
 * @param chomping - `-` strips the final line break, `+` keeps every
 *   trailing one, none keeps a single one
 */
function readBlockScalar(
  folded: boolean,
  chomping: string,
  body: string[],
): string {
  const firstText = body.find((line) => line.trim() !== '');
  if (firstText === undefined) return '';
  const contentIndent = indentOf(firstText);
  const lines = body.map((line) => line.slice(contentIndent));

  let trailing = 0;
  while (lines.length > 0 && (lines.at(-1) ?? '').trim() === '') {
    lines.pop();
    trailing++;
  }

  let text = '';
  if (folded) {
    let emptyLines = 0;
    let previous: string | undefined;
    for (const line of lines) {
      if (line.trim() === '') {
        emptyLines++;
        continue;
      }
      if (previous !== undefined) {
        const keepsBreak = /^[ \t]/.test(previous) || /^[ \t]/.test(line);
        text +=
          emptyLines > 0
            ? '\n'.repeat(emptyLines + (keepsBreak ? 1 : 0))
            : keepsBreak
              ? '\n'
              : ' ';
      } else {
        text += '\n'.repeat(emptyLines);
      }
      text += line;
      previous = line;
      emptyLines = 0;
    }
  } else {
    text = lines.join('\n');
  }

  if (chomping === '-') return text;
  if (chomping === '+') return `${text}${'\n'.repeat(trailing + 1)}`;
  return `${text}\n`;
}

/** Simple escapes of double-quoted scalars */
const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['0', '\0'],
  ['a', '\x07'],
  ['b', '\b'],
  ['t', '\t'],
  ['\t', '\t'],
  ['n', '\n'],
  ['v', '\v'],
  ['f', '\f'],
  ['r', '\r'],
  ['e', '\x1b'],
  [' ', ' '],
  ['"', '"'],
  ['/', '/'],
  ['\\', '\\'],
  ['N', '\u0085'],
  ['_', ' '],
  ['L', ' '],
  ['P', ' '],
]);

/** Number of hex digits after each code point escape */
const HEX_ESCAPES: ReadonlyMap<string, number> = new Map([
  ['x', 2],
  ['u', 4],
  ['U', 8],
]);

/**
 * Resolve the backslash escapes of a double-quoted scalar
 */
function unescapeDoubleQuoted(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    if (char !== '\\') {
      result += char;
      continue;
    }
    const code = text[i + 1] ?? '';
    const digits = HEX_ESCAPES.get(code);
    if (digits !== undefined) {
      const hex = text.slice(i + 2, i + 2 + digits);
      result += String.fromCodePoint(Number.parseInt(hex, 16));
      i += 1 + digits;
    } else {
      result += ESCAPES.get(code) ?? code;
      i++;
    }
  }
  return result;
}

/** Number of leading spaces */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}
