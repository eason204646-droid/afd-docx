import { Document, Block } from "../model/types.js";
import { renderInline } from "./render.js";

export { renderInline } from "./render.js";

export function formatDocument(doc: Document): string {
  const lines: string[] = [];

  lines.push("; AFD v1");

  // Only output front matter if there's actual metadata
  const hasFrontMatter =
    !!doc.meta.title || !!doc.meta.author || !!doc.meta.date ||
    !!doc.meta.page || !!doc.meta.styles ||
    Object.keys(doc.meta).some(k => !["title", "author", "date", "page", "styles"].includes(k));

  if (hasFrontMatter) {
    lines.push("---");
    if (doc.meta.title) lines.push(`title: ${JSON.stringify(doc.meta.title)}`);
    if (doc.meta.author) lines.push(`author: ${JSON.stringify(doc.meta.author)}`);
    if (doc.meta.date) lines.push(`date: ${JSON.stringify(doc.meta.date)}`);
    if (doc.meta.page) {
      const p = doc.meta.page;
      const hasPageProps = !!(p.size || p.margin || p.orientation);
      if (hasPageProps) {
        lines.push(`page:`);
        if (p.size) lines.push(`  size: ${JSON.stringify(p.size)}`);
        if (p.margin) lines.push(`  margin: ${JSON.stringify(p.margin)}`);
        if (p.orientation) lines.push(`  orientation: ${JSON.stringify(p.orientation)}`);
      }
    }
    if (doc.meta.styles) {
      lines.push(`styles:`);
      for (const [name, def] of Object.entries(doc.meta.styles)) {
        lines.push(`  ${name}:`);
        if (def.size) lines.push(`    size: ${def.size}`);
        if (def.bold) lines.push(`    bold: true`);
        if (def.italic) lines.push(`    italic: true`);
        if (def.font) lines.push(`    font: ${JSON.stringify(def.font)}`);
        if (def.color) lines.push(`    color: ${JSON.stringify(def.color)}`);
        if (def["line-height"]) lines.push(`    line-height: ${def["line-height"]}`);
      }
    }
    lines.push("---");
    lines.push("");
  }

  if (doc.header) {
    lines.push(`hdr: ${doc.header}`);
    lines.push("");
  }
  if (doc.footer) {
    lines.push(`ftr: ${doc.footer}`);
    lines.push("");
  }

  for (const block of doc.content) {
    const blockLines = formatBlock(block);
    lines.push(...blockLines);
    lines.push("");
  }

  return lines.join("\n");
}

function formatBlock(block: Block): string[] {
  switch (block.type) {
    case "heading":
      return [`h${block.level}: ${renderInline(block.text)}`];

    case "paragraph":
      return [`p: ${renderInline(block.text)}`];

    case "unordered-list": {
      const result = ["ul:"];
      for (const item of block.items) {
        result.push(`- ${renderInline(item.text)}`);
      }
      result.push("end");
      return result;
    }

    case "ordered-list": {
      const result = ["ol:"];
      for (let i = 0; i < block.items.length; i++) {
        result.push(`${i + 1}. ${renderInline(block.items[i].text)}`);
      }
      result.push("end");
      return result;
    }

    case "checklist": {
      const result = ["cl:"];
      for (const item of block.items) {
        const status = item.checked ? "[x]" : "[ ]";
        result.push(`${status} ${renderInline(item.text)}`);
      }
      result.push("end");
      return result;
    }

    case "table": {
      const opts = [];
      if (block.bordered) opts.push("bordered");
      if (block.header) opts.push("header");
      if (block.columnWidths && block.columnWidths.length > 0) {
        opts.push(`cols:${block.columnWidths.join(",")}`);
      }
      const result = [`tbl: ${opts.join(" ")}`];
      for (const row of block.rows) {
        result.push(`| ${row.map(c => renderInline(c.text)).join(" | ")} |`);
      }
      result.push("end");
      return result;
    }

    case "image": {
      const result = [`img: ${block.src}`];
      if (block.caption) result.push(`cap: ${block.caption}`);
      if (block.width) result.push(`w: ${block.width}`);
      if (block.position) result.push(`pos: ${block.position}`);
      return result;
    }

    case "code": {
      const result = [`code: ${block.lang || ""}`];
      result.push(block.content);
      result.push("end");
      return result;
    }

    case "raw": {
      const result = [`raw: ${block.format || ""}`];
      result.push(block.content);
      result.push("end");
      return result;
    }

    case "page-break":
      return ["br"];

    default:
      return [];
  }
}
