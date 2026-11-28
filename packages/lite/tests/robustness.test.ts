import { describe, expect, it } from 'vitest';
import { extract } from '../src/extract';
import { parse } from '../src/index';

describe('extract - inputs that used to crash or hang', () => {
  it('returns A1111 text that merely mentions sui_image_params as it is', () => {
    const text = 'a photo of sui_image_params, 1girl\nSteps: 20, Seed: 1';
    expect(extract({ parameters: text })).toBe(text);
  });

  it('does not throw on SwarmUI JSON with trailing garbage', () => {
    const text = '{"sui_image_params":{"prompt":"1girl"}}x';
    expect(() => extract({ parameters: text })).not.toThrow();
  });

  it('strips NUL padding from a ComfyUI prompt chunk in linear time', () => {
    const graph =
      '{"1":{"class_type":"CLIPTextEncode","inputs":{"text":"1girl"}}}';
    expect(extract({ prompt: `${graph}${'\0'.repeat(200_000)}` })).toContain(
      '1girl',
    );
    // A byte after the NULs made /\0+$/ retry from every NUL
    expect(() =>
      extract({ prompt: `${graph}${'\0'.repeat(200_000)}x` }),
    ).not.toThrow();
  });

  it('strips NUL padding from a channelled generation_data chunk in linear time', () => {
    const data = `{"prompt":"1girl"}${'\0'.repeat(200_000)}x`;
    expect(() => extract({ generation_data: data })).not.toThrow();
  });

  it('gives up on a Fooocus resolution of digits only in linear time', () => {
    const text = JSON.stringify({
      Model: 'm',
      resolution: '1'.repeat(200_000),
    });
    expect(extract({ parameters: text })).not.toContain('Size:');
  });
});

// ---------------------------------------------------------------------------
// Hand-built containers. Lite does not check PNG CRCs, so they are left zero.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function concat(...parts: Array<Uint8Array | number[]>): Uint8Array {
  const bytes = parts.map((part) => Uint8Array.from(part));
  const out = new Uint8Array(bytes.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const b of bytes) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngChunk(type: string, body: Uint8Array | number[]): Uint8Array {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, body.length);
  return concat(length, encoder.encode(type), body, [0, 0, 0, 0]);
}

/** "UNICODE\0" + UTF-16 text, the usual UserComment encoding */
function unicodeComment(text: string, littleEndian = true): Uint8Array {
  const out = new Uint8Array(8 + text.length * 2);
  out.set(encoder.encode('UNICODE\0'));
  const view = new DataView(out.buffer);
  for (let i = 0; i < text.length; i++)
    view.setUint16(8 + i * 2, text.charCodeAt(i), littleEndian);
  return out;
}

/**
 * TIFF block with an IFD0 that points to an Exif IFD holding one UserComment.
 * `entryCount` overrides the entry count the Exif IFD declares.
 */
function exifBlock(
  userComment: Uint8Array,
  { littleEndian = true, entryCount = 1 } = {},
): Uint8Array {
  const out = new Uint8Array(44 + userComment.length);
  const view = new DataView(out.buffer);
  out.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, 8, littleEndian); // IFD0 offset
  view.setUint16(8, 1, littleEndian); // IFD0: one entry
  view.setUint16(10, 0x8769, littleEndian); // Exif IFD pointer
  view.setUint16(12, 4, littleEndian); // LONG
  view.setUint32(14, 1, littleEndian);
  view.setUint32(18, 26, littleEndian);
  view.setUint16(26, entryCount, littleEndian); // Exif IFD
  view.setUint16(28, 0x9286, littleEndian); // UserComment
  view.setUint16(30, 7, littleEndian); // UNDEFINED
  view.setUint32(32, userComment.length, littleEndian);
  view.setUint32(36, 44, littleEndian);
  out.set(userComment, 44);
  return out;
}

function webpWithExif(exif: Uint8Array): Uint8Array {
  const head = new Uint8Array(20);
  const view = new DataView(head.buffer);
  head.set(encoder.encode('RIFF'));
  view.setUint32(4, 12 + exif.length, true);
  head.set(encoder.encode('WEBPEXIF'), 8);
  view.setUint32(16, exif.length, true);
  return concat(head, exif);
}

function jpegWithExif(exif: Uint8Array): Uint8Array {
  const length = exif.length + 8; // length field + "Exif\0\0"
  return concat(
    [0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff],
    encoder.encode('Exif\0\0'),
    exif,
    [0xff, 0xd9],
  );
}

const A1111_TEXT = '1girl, solo\nSteps: 20, Sampler: Euler a, Seed: 12345';

describe('parse - containers cut short or malformed', () => {
  it('returns "" for data that is not an image', () => {
    expect(parse(new Uint8Array(0))).toBe('');
    expect(parse(new Uint8Array([0x89]))).toBe('');
    expect(parse(encoder.encode('GIF89a'))).toBe('');
    expect(parse(new ArrayBuffer(16))).toBe('');
  });

  it('reads a UserComment from a TIFF block of either byte order', () => {
    for (const littleEndian of [true, false]) {
      const exif = exifBlock(unicodeComment(A1111_TEXT), { littleEndian });
      expect(parse(webpWithExif(exif)), `WebP ${littleEndian}`).toBe(
        A1111_TEXT,
      );
      expect(parse(jpegWithExif(exif)), `JPEG ${littleEndian}`).toBe(
        A1111_TEXT,
      );
    }
  });

  // The byte order of the text is told from its second byte, whatever the
  // byte order of the TIFF block
  it('reads UTF-16 UserComment text of either byte order', () => {
    for (const littleEndian of [true, false]) {
      const comment = unicodeComment(A1111_TEXT, littleEndian);
      expect(parse(webpWithExif(exifBlock(comment))), `${littleEndian}`).toBe(
        A1111_TEXT,
      );
    }
  });

  it('returns "" for a UNICODE UserComment that holds no text', () => {
    const prefix = encoder.encode('UNICODE\0');
    for (const payload of [[], [0x31], [0, 0], [0, 0, 0x31, 0]]) {
      const exif = exifBlock(concat(prefix, payload));
      expect(parse(webpWithExif(exif)), `payload ${payload}`).toBe('');
    }
  });

  it('returns "" for an EXIF block that is not a TIFF structure', () => {
    const exif = exifBlock(unicodeComment(A1111_TEXT));
    const wrongOrder = exif.slice();
    wrongOrder.set([0x58, 0x58]); // neither "II" nor "MM"
    const wrongMagic = exif.slice();
    wrongMagic[2] = 43;
    for (const block of [exif.subarray(0, 7), wrongOrder, wrongMagic]) {
      expect(parse(webpWithExif(block))).toBe('');
      expect(parse(jpegWithExif(block))).toBe('');
    }
  });

  it('reads the entries that fit when an IFD declares more than it holds', () => {
    const exif = exifBlock(unicodeComment(A1111_TEXT), { entryCount: 500 });
    expect(parse(webpWithExif(exif))).toBe(A1111_TEXT);
  });

  it('returns "" when an IFD offset or a value points outside the block', () => {
    const exif = exifBlock(unicodeComment(A1111_TEXT));
    const ifdOutside = exif.slice();
    new DataView(ifdOutside.buffer).setUint32(4, 0xffffffff, true);
    const exifIfdOutside = exif.slice();
    new DataView(exifIfdOutside.buffer).setUint32(18, exif.length + 9, true);
    const valueOutside = exif.slice();
    new DataView(valueOutside.buffer).setUint32(36, exif.length, true);
    for (const block of [ifdOutside, exifIfdOutside, valueOutside]) {
      expect(parse(webpWithExif(block))).toBe('');
    }
  });

  it('returns "" for an EXIF block cut anywhere', () => {
    const exif = exifBlock(unicodeComment(A1111_TEXT));
    for (let length = 0; length < 44; length++) {
      const cut = exif.subarray(0, length);
      expect(() => parse(webpWithExif(cut)), `length ${length}`).not.toThrow();
      expect(parse(jpegWithExif(cut)), `length ${length}`).toBe('');
    }
  });

  it('returns "" for a JPEG that ends inside the Exif identifier', () => {
    const head = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40];
    for (const identifier of ['', 'Ex', 'Exif', 'Exif\0', 'Exif\0\0']) {
      const data = concat(head, encoder.encode(identifier));
      expect(parse(data), JSON.stringify(identifier)).toBe('');
    }
  });

  it('reads an iTXt chunk and skips one with no language terminator', () => {
    const keyword = encoder.encode('parameters');
    const text = encoder.encode(A1111_TEXT);
    // keyword, NUL, compression flag, method, language NUL, translation NUL
    const complete = pngChunk('iTXt', concat(keyword, [0, 0, 0, 0, 0], text));
    expect(parse(concat(PNG_SIGNATURE, complete, pngChunk('IEND', [])))).toBe(
      A1111_TEXT,
    );

    // The file ends inside the chunk, with no NUL left after the flags
    const chunk = pngChunk('iTXt', concat(keyword, [0, 1, 1], text));
    const cut = concat(PNG_SIGNATURE, chunk.subarray(0, chunk.length - 4));
    expect(parse(cut)).toBe('');
    // The same without CRC bytes that happen to be NUL
    const noNul = concat(PNG_SIGNATURE, chunk.fill(0x41, chunk.length - 4));
    expect(parse(noNul)).toBe('');
  });
});

describe('extract - values of unexpected shape', () => {
  it('skips ComfyUI graph entries that are not node objects', () => {
    const graph = JSON.stringify({
      1: null,
      2: 'CLIPTextEncode',
      3: 7,
      4: [],
      5: { class_type: 'KSampler' },
      6: { class_type: 'CLIPTextEncode', inputs: { text: '1girl, solo' } },
      7: { class_type: 'KSampler', inputs: { seed: 12345, steps: 20 } },
    });
    expect(extract({ prompt: graph })).toBe(
      '1girl, solo\nSteps: 20, Seed: 12345',
    );
  });

  it('falls back past an empty text but stops at a zero', () => {
    const text = JSON.stringify({
      prompt: '1girl, solo',
      model: '',
      base_model_name: 'animagine-xl-4.0',
      seed: 0,
      steps: 20,
    });
    expect(extract({ parameters: text })).toBe(
      '1girl, solo\nSteps: 20, Seed: 0, Model: animagine-xl-4.0',
    );
  });

  it('skips values that are neither text nor number', () => {
    const text = JSON.stringify({
      prompt: '1girl, solo',
      model: { hash: 'e3c47aedb0' },
      baseModel: ['95', 0],
      use_upscaler: null,
      steps: 20,
    });
    expect(extract({ parameters: text })).toBe(
      '1girl, solo\nSteps: 20, Model hash: e3c47aedb0',
    );
  });

  it('writes Size only when both sides are known', () => {
    const one = JSON.stringify({ prompt: '1girl', steps: 20, width: 832 });
    expect(extract({ parameters: one })).toBe('1girl\nSteps: 20');
    const both = JSON.stringify({ prompt: '1girl', width: 832, height: 1216 });
    expect(extract({ parameters: both })).toBe('1girl\nSize: 832x1216');
  });

  it('uses the scheduler as the sampler when there is no sampler', () => {
    const text = JSON.stringify({ prompt: '1girl', scheduler: 'euler_a' });
    expect(extract({ parameters: text })).toBe('1girl\nSampler: euler_a');
    const both = JSON.stringify({
      prompt: '1girl',
      sampler: 'Euler a',
      scheduler: 'Karras',
    });
    expect(extract({ parameters: both })).toBe(
      '1girl\nSampler: Euler a, Schedule type: Karras',
    );
  });
});

describe('extract - entries it is given', () => {
  it('does not modify them', () => {
    const cases: Array<Record<string, string>> = [
      { Software: 'NovelAI', Comment: '{"prompt":"1girl","steps":28}' },
      { invokeai_metadata: '{"positive_prompt":"1girl","steps":20}' },
      {
        UserComment:
          '{"extraMetadata":"{\\"prompt\\":\\"1girl\\"}","prompt":{"1":{"class_type":"KSampler","inputs":{"seed":1}}}}',
      },
      { UserComment: A1111_TEXT },
      { UserComment: '{"prompt":{},"workflow":{}}' },
      { UserComment: `{"parameters":${JSON.stringify(A1111_TEXT)}}` },
      { UserComment: '{"prompt":"1girl","steps":20}' },
    ];
    for (const entries of cases) {
      const before = JSON.stringify(entries);
      extract(entries);
      expect(JSON.stringify(entries)).toBe(before);
    }
  });

  it('keeps a parameters entry over data channelled from elsewhere', () => {
    const own = '1girl, solo\nSteps: 20';
    const other = 'landscape\nSteps: 30';
    expect(extract({ parameters: own, UserComment: other })).toBe(own);
    expect(
      extract({
        parameters: own,
        UserComment: `{"parameters":${JSON.stringify(other)}}`,
      }),
    ).toBe(own);
    expect(
      extract({ parameters: own, invokeai_metadata: '{"steps":30}' }),
    ).toBe(own);
    expect(
      extract({ parameters: own, Software: 'NovelAI', Comment: other }),
    ).toBe(own);
  });
});

// One pattern reads the size text of every JSON tool, with no tool detected
// first
describe('extract - size given as one text', () => {
  it('reads "WxH" and a Python tuple, whatever else the JSON holds', () => {
    const forms = ['1152x896', '1152 x 896', '(1152, 896)', '(1152,896)'];
    for (const resolution of forms) {
      const text = JSON.stringify({ prompt: '1girl', steps: 20, resolution });
      expect(extract({ parameters: text }), resolution).toBe(
        '1girl\nSteps: 20, Size: 1152x896',
      );
    }
  });

  it('prefers it over width and height', () => {
    const text = JSON.stringify({
      prompt: '1girl',
      resolution: '1152x896',
      width: 512,
      height: 512,
    });
    expect(extract({ parameters: text })).toBe('1girl\nSize: 1152x896');
  });

  it('falls back to width and height when it holds no size', () => {
    for (const resolution of ['auto', '1152', '', 1152, null]) {
      const text = JSON.stringify({
        Model: 'animagine-xl-4.0',
        base_model: 'animagine-xl-4.0',
        resolution,
        width: 832,
        height: 1216,
      });
      expect(extract({ parameters: text }), `${resolution}`).toBe(
        'Size: 832x1216, Model: animagine-xl-4.0',
      );
    }
  });
});
