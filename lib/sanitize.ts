const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "UL", "OL", "LI", "A", "DIV", "SPAN"]);

export function sanitizeRichHtml(html: string): string {
  if (!html || typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on") || name === "style" || name === "src") {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === "href" || name === "xlink:href") && !/^https?:\/\//i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
}

export function sanitizeCssUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}
