import { Document, Inline, Block } from "../model/types.js";

export function exportHtml(doc: Document): string {
  const parts: string[] = [];

  parts.push("<!DOCTYPE html>");
  parts.push("<html lang=\"en\">");
  parts.push("<head>");
  parts.push("<meta charset=\"UTF-8\">");
  if (doc.meta.title) {
    parts.push(`<title>${escapeHtml(doc.meta.title)}</title>`);
  }
  parts.push("<style>");
  parts.push("body { font-family: Inter, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 2em auto; padding: 0 1em; color: #333; }");
  parts.push("h1, h2, h3, h4, h5, h6 { color: #1a1a1a; }");
  parts.push("code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }");
  parts.push("pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; }");
  parts.push("pre code { background: none; padding: 0; }");
  parts.push("table { border-collapse: collapse; width: 100%; }");
  parts.push("th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }");
  parts.push("th { background: #f2f2f2; }");
  parts.push("blockquote { border-left: 3px solid #ccc; margin: 0; padding: 0 1em; color: #666; }");
  parts.push("img { max-width: 100%; height: auto; }");
  parts.push("</style>");
  parts.push("</head>");
  parts.push("<body>");

  if (doc.meta.title) {
    parts.push(`<h1>${escapeHtml(doc.meta.title)}</h1>`);
  }

  for (const block of doc.content) {
    parts.push(blockToHtml(block));
    parts.push("");
  }

  parts.push("</body>");
  parts.push("</html>");

  return parts.join("\n");
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${renderInlineHtml(block.text)}</h${block.level}>`;

    case "paragraph":
      return `<p>${renderInlineHtml(block.text)}</p>`;

    case "unordered-list":
      return `<ul>\n${block.items.map(i => `  <li>${renderInlineHtml(i.text)}</li>`).join("\n")}\n</ul>`;

    case "ordered-list":
      return `<ol>\n${block.items.map(i => `  <li>${renderInlineHtml(i.text)}</li>`).join("\n")}\n</ol>`;

    case "checklist":
      return `<ul class="checklist">\n${block.items.map(i =>
        `  <li>${i.checked ? "&#x2611;" : "&#x2610;"} ${renderInlineHtml(i.text)}</li>`
      ).join("\n")}\n</ul>`;

    case "table": {
      const rows = block.rows.map((row, ri) => {
        const tag = block.header && ri === 0 ? "th" : "td";
        return `  <tr>${row.map(c => `<${tag}>${renderInlineHtml(c.text)}</${tag}>`).join("")}</tr>`;
      });
      return `<table>\n${rows.join("\n")}\n</table>`;
    }

    case "image": {
      const alt = escapeHtml(block.caption || block.src);
      const align = block.position === "center" ? " style=\"display: block; margin: 0 auto;\"" :
        block.position === "right" ? " style=\"float: right;\"" : "";
      const width = block.width ? ` width="${parseWidthAttr(block.width)}"` : "";
      return `<img src="${escapeHtml(block.src)}" alt="${alt}"${width}${align}>`;
    }

    case "code":
      return `<pre><code${block.lang ? ` class="language-${escapeHtml(block.lang)}"` : ""}>${escapeHtml(block.content)}</code></pre>`;

    case "raw":
      return block.content.split("\n").map(l => `<p>${escapeHtml(l)}</p>`).join("\n");

    case "page-break":
      return "<hr class=\"page-break\">";

    default:
      return "";
  }
}

function renderInlineHtml(inlines: Inline[]): string {
  return inlines.map(inl => {
    switch (inl.type) {
      case "text":
        return escapeHtml(inl.text);
      case "bold":
        return `<strong>${renderInlineHtml(inl.text)}</strong>`;
      case "italic":
        return `<em>${renderInlineHtml(inl.text)}</em>`;
      case "strikethrough":
        return `<del>${renderInlineHtml(inl.text)}</del>`;
      case "code":
        return `<code>${escapeHtml(inl.text)}</code>`;
      case "link":
        return `<a href="${escapeHtml(inl.url)}">${escapeHtml(inl.text)}</a>`;
      case "colored":
        return `<span style="color:${escapeHtml(inl.color)}">${renderInlineHtml(inl.text)}</span>`;
    }
  }).join("");
}

function parseWidthAttr(width: string): string {
  const trimmed = width.trim();
  if (trimmed.endsWith("%")) return trimmed;
  if (trimmed.endsWith("px")) return trimmed.slice(0, -2);
  if (trimmed.endsWith("cm")) return String(Math.round(parseFloat(trimmed) * 37.8));
  return trimmed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
