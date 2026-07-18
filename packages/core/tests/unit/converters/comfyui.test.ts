import { describe, expect, it } from 'vitest';
import {
  convertComfyUIPngToSegments,
  convertComfyUISegmentsToPng,
} from '../../../src/converters/comfyui';
import type { MetadataSegment, PngTextChunk } from '../../../src/types';

const WORKFLOW = '{"nodes": []}';
const PROMPT = '{"1": {"class_type": "KSampler", "inputs": {}}}';

const EXPECTED_CHUNKS: PngTextChunk[] = [
  { type: 'tEXt', keyword: 'prompt', text: PROMPT },
  { type: 'tEXt', keyword: 'workflow', text: WORKFLOW },
];

const PROMPT_CHUNK: PngTextChunk = {
  type: 'tEXt',
  keyword: 'prompt',
  text: PROMPT,
};
const WORKFLOW_CHUNK: PngTextChunk = {
  type: 'tEXt',
  keyword: 'workflow',
  text: WORKFLOW,
};

describe('ComfyUI converter', () => {
  describe('convertComfyUIPngToSegments', () => {
    it('should always write the official Save Animated WEBP tag pair', () => {
      const segments = convertComfyUIPngToSegments([
        PROMPT_CHUNK,
        WORKFLOW_CHUNK,
      ]);

      expect(segments).toEqual([
        { source: { type: 'exifMake', prefix: 'workflow' }, data: WORKFLOW },
        { source: { type: 'exifModel', prefix: 'prompt' }, data: PROMPT },
      ]);
    });

    it('should drop any chunk other than prompt/workflow (e.g. comfy-image-saver parameters)', () => {
      const parametersChunk: PngTextChunk = {
        type: 'tEXt',
        keyword: 'parameters',
        text: 'Steps: 20, Sampler: euler',
      };

      const segments = convertComfyUIPngToSegments([
        parametersChunk,
        PROMPT_CHUNK,
        WORKFLOW_CHUNK,
      ]);

      expect(segments).toEqual([
        { source: { type: 'exifMake', prefix: 'workflow' }, data: WORKFLOW },
        { source: { type: 'exifModel', prefix: 'prompt' }, data: PROMPT },
      ]);
    });

    it('should write only a Make tag for a workflow-only PNG (no prompt chunk)', () => {
      const segments = convertComfyUIPngToSegments([WORKFLOW_CHUNK]);

      expect(segments).toEqual([
        { source: { type: 'exifMake', prefix: 'workflow' }, data: WORKFLOW },
      ]);
    });

    it('should round-trip back to prompt/workflow PNG chunks via convertComfyUISegmentsToPng', () => {
      const segments = convertComfyUIPngToSegments([
        PROMPT_CHUNK,
        WORKFLOW_CHUNK,
      ]);
      const chunks = convertComfyUISegmentsToPng(segments);

      expect(chunks).toEqual(EXPECTED_CHUNKS);
    });
  });

  describe('labelled IFD0 tag formats', () => {
    it('should route Save Animated WEBP tags by their label', () => {
      // The built-in node puts the workflow in Make and the prompt in Model —
      // the reverse of save-image-extended, so routing by tag would swap them.
      const segments: MetadataSegment[] = [
        { source: { type: 'exifMake', prefix: 'workflow' }, data: WORKFLOW },
        { source: { type: 'exifModel', prefix: 'prompt' }, data: PROMPT },
      ];

      const chunks = convertComfyUISegmentsToPng(segments);

      expect(chunks).toEqual(EXPECTED_CHUNKS);
    });

    it('should route save-image-extended tags by their label', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifImageDescription', prefix: 'Workflow' },
          data: WORKFLOW,
        },
        { source: { type: 'exifMake', prefix: 'Prompt' }, data: PROMPT },
      ];

      const chunks = convertComfyUISegmentsToPng(segments);

      expect(chunks).toEqual(EXPECTED_CHUNKS);
    });

    it('should fall back to the save-image-extended layout when unlabelled', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifImageDescription' }, data: WORKFLOW },
        { source: { type: 'exifMake' }, data: PROMPT },
      ];

      const chunks = convertComfyUISegmentsToPng(segments);

      expect(chunks).toEqual(EXPECTED_CHUNKS);
    });

    it('should convert a Model tag on its own', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifModel', prefix: 'prompt' }, data: PROMPT },
      ];

      const chunks = convertComfyUISegmentsToPng(segments);

      expect(chunks).toEqual([
        { type: 'tEXt', keyword: 'prompt', text: PROMPT },
      ]);
    });
  });
});
