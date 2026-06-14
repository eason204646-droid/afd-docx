import * as fs from "fs";
import mammoth from "mammoth";
import { Document, Inline, ListItem, TableCell } from "../model/types.js";

export async function importDocx(filePath: string): Promise<Document> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const doc = htmlToDocument(result.value);
  return doc;
}

function htmlToDocument(html: string): Document {
  const doc: Document = {
    version: 1,
    meta: {},
    content: [],
  };

  // Extract title from <h1> if it's the first element
  const firstH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (firstH1) {
    const text = stripHtml(firstH1[1]).trim();
    if (text) doc.meta.title = text;
  }

  // Normalize: add newlines after block elements
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h([1-6])>/gi, "</h$1>\n")
    .replace(/<\/p>/gi, "</p>\n")
    .replace(/<\/li>/gi, "</li>\n")
    .replace(/<\/tr>/gi, "</tr>\n")
    .replace(/<\/table>/gi, "</table>\n");

  // Tokenize into block-level elements
  const blocks: string[] = [];
  const blockRegex = /<(h[1-6]|p|ul|ol|li|table|pre|blockquote|img)[^>]*>[\s\S]*?<\/\1>/gi;
  let match;

  while ((match = blockRegex.exec(normalized)) !== null) {
    blocks.push(match[0]);
  }

  // If no blocks found, try line-by-line fallback
  if (blocks.length === 0) {
    const lines = normalized.split(/\n/).map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      const text = stripHtml(line);
      if (text) {
        doc.content.push({ type: "paragraph", text: parseSimpleInline(text) });
      }
    }
    return doc;
  }

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Heading
    const hMatch = block.match(/^<h([1-6])[^>]*>([\s\S]*)<\/h\1>$/i);
    if (hMatch) {
      const level = parseInt(hMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6;
      const text = stripHtml(hMatch[2]).trim();
      if (text) {
        doc.content.push({ type: "heading", level, text: parseSimpleInline(text) });
      }
      i++;
      continue;
    }

    // Unordered list
    if (/^<ul/i.test(block)) {
      const items = extractListItems(block, "ul");
      if (items.length > 0) {
        doc.content.push({ type: "unordered-list", items });
      }
      i++;
      continue;
    }

    // Ordered list
    if (/^<ol/i.test(block)) {
      const items = extractListItems(block, "ol");
      if (items.length > 0) {
        doc.content.push({ type: "ordered-list", items });
      }
      i++;
      continue;
    }

    // List item (standalone, not wrapped in ul/ol)
    if (/^<li/i.test(block)) {
      const items: ListItem[] = [];
      while (i < blocks.length && /^<li/i.test(blocks[i])) {
        const text = stripHtml(blocks[i]).trim();
        if (text) {
          items.push({ text: parseSimpleInline(text) });
        }
        i++;
      }
      if (items.length > 0) {
        doc.content.push({ type: "unordered-list", items });
      }
      continue;
    }

    // Table
    if (/^<table/i.test(block)) {
      const { rows, bordered, header } = parseTableHtml(block);
      if (rows.length > 0) {
        doc.content.push({ type: "table", bordered, header, rows });
      }
      i++;
      continue;
    }

    // Code block
    if (/^<pre/i.test(block)) {
      const text = stripHtml(block).trim();
      if (text) {
        doc.content.push({ type: "code", content: text, lang: "" });
      }
      i++;
      continue;
    }

    // Blockquote
    if (/^<blockquote/i.test(block)) {
      const text = stripHtml(block).trim();
      const items: ListItem[] = [{ text: parseSimpleInline(text) }];
      doc.content.push({ type: "unordered-list", items });
      i++;
      continue;
    }

    // Paragraph
    if (/^<p/i.test(block)) {
      const text = stripHtml(block).trim();
      if (text) {
        doc.content.push({ type: "paragraph", text: parseSimpleInline(text) });
      }
      i++;
      continue;
    }

    // Skip unrecognized
    i++;
  }

  return doc;
}

function extractListItems(block: string, _type: string): ListItem[] {
  const items: ListItem[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(block)) !== null) {
    const text = stripHtml(match[1]).trim();
    if (text) {
      items.push({ text: parseSimpleInline(text) });
    }
  }
  return items;
}

function parseTableHtml(tableHtml: string): { rows: TableCell[][]; bordered: boolean; header: boolean } {
  const rows: TableCell[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let isHeader = false;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells: TableCell[] = [];
    // Check if this is a header row
    if (/<th/i.test(rowMatch[1])) isHeader = true;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const text = stripHtml(cellMatch[1]).trim();
      cells.push({ text: parseSimpleInline(text) });
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return { rows, bordered: true, header: isHeader || rows.length > 1 };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function parseSimpleInline(text: string): Inline[] {
  const result: Inline[] = [];
  // Process bold (**text**), italic (*text*), code (`text`), links [text](url)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      result.push({ type: "bold", text: [{ type: "text", text: inner }] });
    } else if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      const inner = part.slice(1, -1);
      result.push({ type: "italic", text: [{ type: "text", text: inner }] });
    } else if (part.startsWith("`") && part.endsWith("`")) {
      result.push({ type: "code", text: part.slice(1, -1) });
    } else if (part.startsWith("[") && part.includes("](")) {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        result.push({ type: "link", text: linkMatch[1], url: linkMatch[2] });
      } else {
        result.push({ type: "text", text: part });
      }
    } else {
      result.push({ type: "text", text: part });
    }
  }
  return result;
}
