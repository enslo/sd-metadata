import { describe, expect, it } from 'vitest';
import { extractXmpEntries, isXmpKeyword } from '../../../src/utils/xmp';

describe('XMP utilities', () => {
  describe('isXmpKeyword', () => {
    it('should match XMP keyword', () => {
      expect(isXmpKeyword('XML:com.adobe.xmp')).toBe(true);
    });

    it('should not match other keywords', () => {
      expect(isXmpKeyword('parameters')).toBe(false);
      expect(isXmpKeyword('Software')).toBe(false);
    });
  });

  describe('extractXmpEntries', () => {
    const sampleXmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 6.0.0">
   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about=""
            xmlns:dc="http://purl.org/dc/elements/1.1/"
            xmlns:xmp="http://ns.adobe.com/xap/1.0/"
            xmlns:exif="http://ns.adobe.com/exif/1.0/">
         <dc:description>
            <rdf:Alt>
               <rdf:li xml:lang="x-default">a cat&#xA;Steps: 20, Sampler: euler</rdf:li>
            </rdf:Alt>
         </dc:description>
         <xmp:CreatorTool>Draw Things</xmp:CreatorTool>
         <exif:UserComment>
            <rdf:Alt>
               <rdf:li xml:lang="x-default">{"c":"a cat","uc":"bad","steps":20}</rdf:li>
            </rdf:Alt>
         </exif:UserComment>
      </rdf:Description>
   </rdf:RDF>
</x:xmpmeta>`;

    it('should extract CreatorTool', () => {
      const result = extractXmpEntries(sampleXmp);

      expect(result).not.toBeNull();
      expect(result?.CreatorTool).toBe('Draw Things');
    });

    it('should extract UserComment JSON', () => {
      const result = extractXmpEntries(sampleXmp);

      expect(result?.UserComment).toBe('{"c":"a cat","uc":"bad","steps":20}');
    });

    it('should extract dc:description as parameters with decoded entities', () => {
      const result = extractXmpEntries(sampleXmp);

      expect(result?.parameters).toBe('a cat\nSteps: 20, Sampler: euler');
    });

    it('should decode XML entities', () => {
      const xmp = `<x:xmpmeta>
        <rdf:RDF>
          <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:description>
              <rdf:Alt>
                <rdf:li xml:lang="x-default">a &amp; b &lt;c&gt; &quot;d&quot;</rdf:li>
              </rdf:Alt>
            </dc:description>
          </rdf:Description>
        </rdf:RDF>
      </x:xmpmeta>`;

      const result = extractXmpEntries(xmp);

      expect(result?.parameters).toBe('a & b <c> "d"');
    });

    it('should return null for non-XMP content', () => {
      const result = extractXmpEntries('not xml at all');

      expect(result).toBeNull();
    });

    it('should return null for XMP without recognized fields', () => {
      const xmp = `<x:xmpmeta>
        <rdf:RDF>
          <rdf:Description>
            <other:field>value</other:field>
          </rdf:Description>
        </rdf:RDF>
      </x:xmpmeta>`;

      const result = extractXmpEntries(xmp);

      expect(result).toBeNull();
    });
  });
});
