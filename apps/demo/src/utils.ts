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
 * Detect if text is JSON
 *
 * @param text - Text to check
 * @returns true if text is valid JSON
 */
export function isJson(text: string): boolean {
  try {
    // Trim NUL characters that some tools append
    JSON.parse(text.replace(/\0+$/, ''));
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
    // Trim NUL characters that some tools append
    const cleaned = text.replace(/\0+$/, '');
    const parsed = JSON.parse(cleaned);
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
