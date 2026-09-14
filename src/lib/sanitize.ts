/**
 * Conservative allow-list sanitiser for the RICH_TEXT field.
 *
 * Wix stores RICH_TEXT as an HTML string, which we render with set:html. The
 * content is authored by the shelter in the dashboard rather than by the
 * public, so this is defence in depth rather than the primary control — but a
 * compromised or careless dashboard account should not be able to inject
 * script into every visitor's browser.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'blockquote',
  'h2', 'h3', 'h4', 'a', 'span', 'div',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
};

export function sanitizeRichText(html?: string | null): string {
  if (!html) return '';
  let out = String(html);

  // Drop whole elements whose content is never renderable copy.
  out = out.replace(/<(script|style|iframe|object|embed|form|input|template)\b[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed|form|input|template)\b[^>]*\/?>/gi, '');

  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed) return `<${tag}>`;

    const kept: string[] = [];
    const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? '';
      if (!allowed.has(name)) continue;
      // Block javascript:, data:, vbscript: and friends on href.
      if (name === 'href' && !/^(https?:|mailto:|tel:|\/|#)/i.test(value.trim())) continue;
      kept.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }
    if (tag === 'a') {
      const href = kept.find((k) => k.startsWith('href='));
      if (!href) return '<span>';
      // Anything leaving the site opens safely.
      if (/href="https?:/i.test(href)) kept.push('rel="noopener noreferrer"');
    }
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}>`;
  });

  // Strip any inline event handlers that survived as loose text.
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return out;
}
