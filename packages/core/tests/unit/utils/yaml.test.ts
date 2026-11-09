import { describe, expect, it } from 'vitest';
import { parseYamlMapping } from '../../../src/utils/yaml';

/** Value of `key` in a one-key mapping written from the given lines */
function scalar(...lines: string[]): unknown {
  return parseYamlMapping(lines.join('\n'))?.key;
}

describe('parseYamlMapping - Unit Tests', () => {
  describe('mappings', () => {
    it('should read nested mappings by indentation', () => {
      expect(
        parseYamlMapping(
          '\nJobId: job\nFunction: text2image\nInput:\n  prompt: a cat\n  steps: 20\nAfter: x\n',
        ),
      ).toEqual({
        JobId: 'job',
        Function: 'text2image',
        Input: { prompt: 'a cat', steps: '20' },
        After: 'x',
      });
    });

    it('should return undefined for text that is not a mapping', () => {
      expect(parseYamlMapping('just some text')).toBeUndefined();
      expect(parseYamlMapping('')).toBeUndefined();
    });

    it('should return undefined when keys are indented inconsistently', () => {
      // c is shallower than its sibling b but deeper than the top level
      expect(parseYamlMapping('a:\n    b: 1\n  c: 2')).toBeUndefined();
    });
  });

  describe('plain scalars', () => {
    it('should read a value as written', () => {
      expect(scalar('key: worst quality, bad quality,')).toBe(
        'worst quality, bad quality,',
      );
    });

    it('should fold a value wrapped over lines into spaces', () => {
      expect(scalar('key: long prompt that', '  goes on', '  and on')).toBe(
        'long prompt that goes on and on',
      );
    });

    it('should drop the spaces around a folded line break', () => {
      expect(scalar('key: first', '  second   ', '    third')).toBe(
        'first second third',
      );
    });

    it('should read an empty line inside the value as a newline', () => {
      expect(scalar('key: first', '', '  second')).toBe('first\nsecond');
    });

    it('should ignore blank lines before the next key', () => {
      expect(parseYamlMapping('key: value\n\n\nnext: 1')).toEqual({
        key: 'value',
        next: '1',
      });
    });
  });

  describe('single-quoted scalars', () => {
    it("should read '' as an empty value and as one quote", () => {
      expect(scalar("key: ''")).toBe('');
      expect(scalar("key: 'it''s #1'")).toBe("it's #1");
    });

    it('should fold a quoted value wrapped over lines', () => {
      expect(scalar("key: 'a: b, c", "  d'' e'")).toBe("a: b, c d' e");
    });
  });

  describe('double-quoted scalars', () => {
    it('should resolve escapes', () => {
      expect(scalar('key: "tab\\tquote\\"\\u30C6\\x41\\\\"')).toBe(
        'tab\tquote"テA\\',
      );
    });

    it('should join a line ending in a backslash without a space', () => {
      expect(scalar('key: "abc\\', '  def"')).toBe('abcdef');
    });

    it('should keep a doubled backslash at the end of a line', () => {
      expect(scalar('key: "abc\\\\', '  def"')).toBe('abc\\ def');
    });
  });

  describe('block scalars', () => {
    it('should fold >- lines, with an empty line as a newline', () => {
      expect(
        scalar(
          'key: >-',
          '  general, masterpiece, ',
          '',
          '  1girl, solo',
          '  next line',
        ),
      ).toBe('general, masterpiece, \n1girl, solo next line');
    });

    it('should keep empty lines before the text of > as newlines', () => {
      expect(scalar('key: >-', '', '  text')).toBe('\ntext');
    });

    it('should keep line breaks around more-indented lines of >', () => {
      expect(scalar('key: >-', '  a', '    indented', '  b')).toBe(
        'a\n  indented\nb',
      );
    });

    it('should keep line breaks of | as written', () => {
      expect(scalar('key: |-', '  line 1', '  line 2')).toBe('line 1\nline 2');
    });

    it('should apply the chomping indicator', () => {
      expect(scalar('key: |', '  text', '', '')).toBe('text\n');
      expect(scalar('key: |+', '  text', '', '')).toBe('text\n\n\n');
      expect(scalar('key: >-', '  text', '', '')).toBe('text');
    });
  });
});

describe('parseYamlMapping - malformed escapes', () => {
  it('should keep a code point escape it cannot decode as written', () => {
    // Not hex digits, past U+10FFFF, and cut short at the end of the text
    expect(scalar('key: "a\\xZZb"')).toBe('a\\xZZb');
    expect(scalar('key: "a\\U7FFFFFFFb"')).toBe('a\\U7FFFFFFFb');
    expect(scalar('key: "a\\x4"')).toBe('a\\x4');
  });
});

describe('parseYamlMapping - long lines', () => {
  it('folds a wrapped scalar with a long run of blanks in linear time', () => {
    // The trailing-blank trim `/[ \t]+$/` was retried from every blank
    const blanks = ' '.repeat(150_000);
    expect(scalar(`key: x${blanks}y`, '  z')).toBe(`x${blanks}y z`);
  });
});
