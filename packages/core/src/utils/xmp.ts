// XMP chunk keyword used in PNG iTXt chunks
const XMP_KEYWORD = 'XML:com.adobe.xmp';

/** XMP APP1 prefix for JPEG: "http://ns.adobe.com/xap/1.0/\0" */
export const XMP_APP1_PREFIX = /* @__PURE__ */ new TextEncoder().encode(
  'http://ns.adobe.com/xap/1.0/\0',
);

/**
 * Check if data at offset matches the XMP APP1 prefix
 */
export function matchesXmpPrefix(data: Uint8Array, offset: number): boolean {
  if (offset + XMP_APP1_PREFIX.length > data.length) return false;
  for (let i = 0; i < XMP_APP1_PREFIX.length; i++) {
    if (data[offset + i] !== XMP_APP1_PREFIX[i]) return false;
  }
  return true;
}

/**
 * Check if a PNG chunk keyword is an XMP chunk
 */
export function isXmpKeyword(keyword: string): boolean {
  return keyword === XMP_KEYWORD;
}

/** Max XMP text size for regex parsing (aligned with JPEG segment limit) */
const MAX_XMP_TEXT_LENGTH = 65_535;

/**
 * Extract metadata entries from XMP (Adobe XML Metadata) text
 *
 * Parses XMP XML using regex to extract generation metadata fields
 * without requiring an XML parser dependency.
 *
 * Supported fields:
 * - xmp:CreatorTool -> CreatorTool
 * - exif:UserComment (rdf:Alt/rdf:li) -> UserComment
 * - dc:description (rdf:Alt/rdf:li) -> parameters
 *
 * @param xmpText - Raw XMP XML string
 * @returns Entry record with extracted fields, or null if no fields found
 */
export function extractXmpEntries(
  xmpText: string,
): Record<string, string> | null {
  // Reject unreasonably large XMP to prevent ReDoS on malformed XML
  if (xmpText.length > MAX_XMP_TEXT_LENGTH) return null;
  const candidates: [string, string | undefined][] = [
    ['CreatorTool', extractSimpleElement(xmpText, 'xmp', 'CreatorTool')],
    ['UserComment', extractAltElement(xmpText, 'exif', 'UserComment')],
    ['parameters', extractAltElement(xmpText, 'dc', 'description')],
  ];

  const entries = candidates.filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * Extract text from a simple XMP element (e.g., <xmp:CreatorTool>text</xmp:CreatorTool>)
 */
function extractSimpleElement(
  xmp: string,
  ns: string,
  field: string,
): string | undefined {
  const pattern = new RegExp(`<${ns}:${field}>([^<]*)</${ns}:${field}>`);
  const match = xmp.match(pattern);
  return match?.[1] ? decodeXmlEntities(match[1]) : undefined;
}

/**
 * Extract text from an rdf:Alt XMP element
 *
 * Matches structure:
 *   <ns:field>
 *     <rdf:Alt>
 *       <rdf:li xml:lang="x-default">text</rdf:li>
 *     </rdf:Alt>
 *   </ns:field>
 */
function extractAltElement(
  xmp: string,
  ns: string,
  field: string,
): string | undefined {
  const openTag = `<${ns}:${field}>`;
  const closeTag = `</${ns}:${field}>`;

  const start = xmp.indexOf(openTag);
  if (start === -1) return undefined;

  const end = xmp.indexOf(closeTag, start);
  if (end === -1) return undefined;

  const inner = xmp.slice(start + openTag.length, end);

  let pos = 0;
  while (pos < inner.length) {
    const liStart = inner.indexOf('<rdf:li', pos);
    if (liStart === -1) return undefined;

    const tagEnd = inner.indexOf('>', liStart);
    if (tagEnd === -1) return undefined;

    if (inner[tagEnd - 1] === '/') {
      pos = tagEnd + 1;
      continue;
    }

    const contentStart = tagEnd + 1;
    const liClose = inner.indexOf('</rdf:li>', contentStart);
    if (liClose === -1) return undefined;

    const content = inner.slice(contentStart, liClose);
    return content ? decodeXmlEntities(content) : undefined;
  }

  return undefined;
}

/**
 * Decode XML character entities to their string equivalents
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return match;
      }
    })
    .replace(/&#(\d+);/g, (match, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return match;
      }
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // &amp; must be last
}
