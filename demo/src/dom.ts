/**
 * DOM element creation helpers
 *
 * Provides a simple, type-safe way to create DOM elements
 * similar to React's createElement but without a framework.
 */

/**
 * Allowed children types for h() function
 */
export type Child = Node | string | number | null | undefined | false;

/**
 * Create an HTML element with attributes and children
 *
 * @param tag - HTML tag name
 * @param attrs - Element attributes (class, id, etc.)
 * @param children - Child nodes or text
 * @returns Created HTML element
 *
 * @example
 * ```ts
 * h('div', { class: 'container' }, [
 *   h('h1', {}, ['Hello World']),
 *   h('p', {}, ['Some text here']),
 * ])
 * ```
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean> = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  // Set attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'boolean') {
      if (value) el.setAttribute(key, '');
    } else {
      el.setAttribute(key, value);
    }
  }

  // Append children
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Create a text node
 *
 * @param text - Text content
 * @returns Text node
 */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/**
 * Create a document fragment from multiple children
 *
 * @param children - Child nodes
 * @returns Document fragment
 */
export function fragment(children: Child[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    if (typeof child === 'string' || typeof child === 'number') {
      frag.appendChild(document.createTextNode(String(child)));
    } else {
      frag.appendChild(child);
    }
  }
  return frag;
}
