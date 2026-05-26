/**
 * Utility functions for the demo site
 */

/**
 * Escape HTML special characters
 *
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize text for strict JSON.parse.
 *
 * - Trims trailing NUL bytes that some tools append to PNG tEXt chunks.
 * - Replaces NaN literals at JSON value positions (after ":", "," or "[")
 *   with null. ComfyUI custom nodes such as DPRandomGenerator emit
 *   `"is_changed": [NaN]`, which is not valid JSON and would otherwise
 *   collapse the raw view into a single unformatted line.
 */
function sanitizeJsonText(text: string): string {
  return text.replace(/\0+$/, '').replace(/([:,[])\s*NaN\b/g, '$1null');
}

/**
 * Detect if text is JSON
 *
 * @param text - Text to check
 * @returns true if text is valid JSON
 */
export function isJson(text: string): boolean {
  try {
    JSON.parse(sanitizeJsonText(text));
    return true;
  } catch {
    return false;
  }
}

/**
 * Format text as JSON if valid, otherwise return as-is
 *
 * @param text - Text to format
 * @returns Formatted text and whether it was JSON
 */
export function formatJson(text: string): {
  formatted: string;
  isJson: boolean;
} {
  try {
    const parsed = JSON.parse(sanitizeJsonText(text));
    return {
      formatted: JSON.stringify(parsed, null, 2),
      isJson: true,
    };
  } catch {
    return {
      formatted: text,
      isJson: false,
    };
  }
}
