/**
 * Test helper for validating ComfyNodeGraph structure
 */

import { expect } from 'vitest';
import type { ComfyNodeGraph } from '../../src/types';

/**
 * Assert that a value conforms to the ComfyNodeGraph type structure
 *
 * This validates that our type definition matches real-world samples.
 *
 * @param value - Value to validate
 * @param excludeNodeIds - Node IDs to skip validation (e.g., Civitai's 'extra', 'extraMetadata')
 */
export function expectComfyNodeGraph(
  value: unknown,
  excludeNodeIds: string[] = [],
): asserts value is ComfyNodeGraph {
  // Must be an object
  expect(typeof value).toBe('object');
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);

  const graph = value as Record<string, unknown>;
  const nodeIds = Object.keys(graph);

  // Should have at least one node
  expect(nodeIds.length).toBeGreaterThan(0);

  // Validate each node
  for (const [_nodeId, node] of Object.entries(graph)) {
    // Skip excluded nodes (e.g., Civitai's custom metadata nodes)
    if (excludeNodeIds.includes(_nodeId)) {
      continue;
    }
    // Node must be an object
    expect(typeof node).toBe('object');
    expect(node).not.toBeNull();

    const nodeObj = node as Record<string, unknown>;

    // Required: class_type (string, non-empty)
    expect(nodeObj).toHaveProperty('class_type');
    expect(typeof nodeObj.class_type).toBe('string');
    expect((nodeObj.class_type as string).length).toBeGreaterThan(0);

    // Required: inputs (object)
    expect(nodeObj).toHaveProperty('inputs');
    expect(typeof nodeObj.inputs).toBe('object');
    expect(nodeObj.inputs).not.toBeNull();

    // Optional: _meta
    if ('_meta' in nodeObj) {
      expect(typeof nodeObj._meta).toBe('object');
      if (nodeObj._meta && typeof nodeObj._meta === 'object') {
        const meta = nodeObj._meta as Record<string, unknown>;
        if ('title' in meta) {
          expect(typeof meta.title).toBe('string');
        }
      }
    }

    // Optional: is_changed
    if ('is_changed' in nodeObj) {
      const isChanged = nodeObj.is_changed;
      // Can be null, undefined, or string[]
      if (isChanged !== null && isChanged !== undefined) {
        expect(Array.isArray(isChanged)).toBe(true);
        if (Array.isArray(isChanged)) {
          for (const item of isChanged) {
            expect(typeof item).toBe('string');
          }
        }
      }
    }
  }
}
