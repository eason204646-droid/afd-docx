import { parse as parseYaml } from "yaml";
import { Document, Inline, ListItem, TableCell, StyleDef } from "../model/types.js";
import { tokenize } from "./lexer.js";

/**
 * Parse inline formatting from a text string.
 * Supports: **bold**, *italic*, `code`, [link](url), ~~strikethrough~~, {color:...}text{/color}
 */
export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let i = 0;
  let textBuffer = "";

  function flushText() {
    if (textBuffer) {
      result.push({ type: "text", text: textBuffer });
      textBuffer = "";
    }
  }

  while (i < text.length) {
    let matched = false;

    // Bold: **text**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flushText();
        result.push({ type: "bold", text: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        matched = true;
        continue;
      }
    }

    // Italic: *text* (but not **)
    if (!matched && text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        flushText();
        result.push({ type: "italic", text: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        matched = true;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (!matched && text.startsWith("~~", i)) {
      const end = text.indexOf("~~", i + 2);
      if (end !== -1) {
        flushText();
        result.push({ type: "strikethrough", text: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        matched = true;
        continue;
      }
    }

    // Code: `text`
    if (!matched && text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flushText();
        result.push({ type: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        matched = true;
        continue;
      }
    }

    // Link: [text](url)
    if (!matched && text[i] === "[") {
      const closeBracket = text.indexOf("](", i);
      if (closeBracket !== -1) {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          flushText();
          const linkText = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          result.push({ type: "link", text: linkText, url });
          i = closeParen + 1;
          matched = true;
          continue;
        }
      }
    }

    // Colored text: {color:red}text{/color}
    if (!matched && text[i] === "{" && text.startsWith("{color:", i)) {
      const colonEnd = text.indexOf("}", i);
      if (colonEnd !== -1) {
        const color = text.slice(i + 7, colonEnd);
        const closeTag = text.indexOf("{/color}", colonEnd + 1);
        if (closeTag !== -1) {
          flushText();
          result.push({ type: "colored", color, text: parseInline(text.slice(colonEnd + 1, closeTag)) });
          i = closeTag + 8;
          matched = true;
          continue;
        }
      }
    }

    if (!matched) {
      textBuffer += text[i];
      i++;
    }
  }

  flushText();
  return result;
}

export interface ParseResult {
  document: Document;
  errors: ParseError[];
}

export interface ParseError {
  lineNumber: number;
  message: string;
}

/**
 * Parse AFD source text into a Document model.
 */
export function parse(source: string): ParseResult {
  const tokens = tokenize(source);
  const errors: ParseError[] = [];
  const doc: Document = {
    version: 1,
    meta: {},
    content: [],
  };

  let i = 0;
  let frontMatterLines: string[] = [];

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token.type) {
      case "comment":
      case "empty":
        i++;
        break;

      case "frontmatter-start": {
        i++;
        frontMatterLines = [];
        while (i < tokens.length && tokens[i].type !== "frontmatter-end") {
          if (tokens[i].type === "frontmatter-line") {
            frontMatterLines.push(tokens[i].value);
          }
          i++;
        }
        if (i < tokens.length) i++; // skip frontmatter-end

        const yamlText = frontMatterLines.join("\n");
        try {
          const parsed = parseYaml(yamlText);
          if (parsed && typeof parsed === "object") {
            applyFrontMatter(doc, parsed as Record<string, unknown>);
          }
        } catch (e: any) {
          errors.push({ lineNumber: 1, message: `Front matter parse error: ${e.message}` });
        }
        break;
      }

      case "heading": {
        const level = parseInt(token.raw.trim()[1]) as 1 | 2 | 3 | 4 | 5 | 6;
        doc.content.push({ type: "heading", level, text: parseInline(token.value) });
        i++;
        break;
      }

      case "paragraph": {
        doc.content.push({ type: "paragraph", text: parseInline(token.value) });
        i++;
        break;
      }

      case "unordered-list-start": {
        i++;
        const items: ListItem[] = [];
        while (i < tokens.length && tokens[i].type !== "list-end") {
          if (tokens[i].type === "unordered-item") {
            items.push({ text: parseInline(tokens[i].value) });
          }
          i++;
        }
        if (i < tokens.length) i++; // skip list-end
        doc.content.push({ type: "unordered-list", items });
        break;
      }

      case "ordered-list-start": {
        i++;
        const items: ListItem[] = [];
        while (i < tokens.length && tokens[i].type !== "list-end") {
          if (tokens[i].type === "ordered-item") {
            items.push({ text: parseInline(tokens[i].value) });
          }
          i++;
        }
        if (i < tokens.length) i++; // skip list-end
        doc.content.push({ type: "ordered-list", items });
        break;
      }

      case "checklist-start": {
        i++;
        const items: ListItem[] = [];
        while (i < tokens.length && tokens[i].type !== "list-end") {
          if (tokens[i].type === "checklist-item") {
            const v = tokens[i].value;
            const checked = v.startsWith("[x]");
            const text = v.slice(4);
            items.push({ checked, text: parseInline(text) });
          }
          i++;
        }
        if (i < tokens.length) i++; // skip list-end
        doc.content.push({ type: "checklist", items });
        break;
      }

      case "table-start": {
        i++;
        const rows: TableCell[][] = [];
        let bordered = false;
        let header = false;
        const opts = token.value;
        if (opts) {
          bordered = opts.includes("bordered");
          header = opts.includes("header");
        }
        while (i < tokens.length && tokens[i].type !== "table-end") {
          if (tokens[i].type === "table-row") {
            const cells = parseTableRow(tokens[i].value);
            rows.push(cells);
          }
          i++;
        }
        if (i < tokens.length) i++; // skip table-end
        doc.content.push({ type: "table", bordered, header, rows });
        break;
      }

      case "image": {
        i++;
        let caption: string | undefined;
        let width: string | undefined;
        let position: string | undefined;
        while (i < tokens.length && (
          tokens[i].type === "image-caption" ||
          tokens[i].type === "image-width" ||
          tokens[i].type === "image-pos"
        )) {
          if (tokens[i].type === "image-caption") caption = tokens[i].value;
          if (tokens[i].type === "image-width") width = tokens[i].value;
          if (tokens[i].type === "image-pos") position = tokens[i].value;
          i++;
        }
        doc.content.push({ type: "image", src: token.value, caption, width, position });
        break;
      }

      case "code-start": {
        i++;
        const lines: string[] = [];
        while (i < tokens.length && tokens[i].type !== "code-end") {
          if (tokens[i].type === "code-line") {
            lines.push(tokens[i].value);
          }
          i++;
        }
        if (i < tokens.length) i++; // skip code-end
        doc.content.push({
          type: "code",
          lang: token.value || undefined,
          content: lines.join("\n"),
        });
        break;
      }

      case "raw-start": {
        i++;
        const lines: string[] = [];
        while (i < tokens.length && tokens[i].type !== "raw-end") {
          if (tokens[i].type === "raw-line") {
            lines.push(tokens[i].value);
          }
          i++;
        }
        if (i < tokens.length) i++; // skip raw-end
        doc.content.push({
          type: "raw",
          format: token.value || undefined,
          content: lines.join("\n"),
        });
        break;
      }

      case "page-break": {
        doc.content.push({ type: "page-break" });
        i++;
        break;
      }

      case "header-line": {
        doc.header = token.value;
        i++;
        break;
      }

      case "footer-line": {
        doc.footer = token.value;
        i++;
        break;
      }

      case "unclosed-block": {
        errors.push({ lineNumber: token.lineNumber, message: token.value });
        i++;
        break;
      }

      default:
        i++;
        break;
    }
  }

  return { document: doc, errors };
}

function parseTableRow(line: string): TableCell[] {
  let inner = line.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);

  const cells: TableCell[] = [];
  let current = "";
  let inCode = false;
  for (const ch of inner) {
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      cells.push({ text: parseInline(current.trim()) });
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push({ text: parseInline(current.trim()) });
  return cells;
}

function applyFrontMatter(doc: Document, data: Record<string, unknown>): void {
  if (typeof data.title === "string") doc.meta.title = data.title;
  if (typeof data.author === "string") doc.meta.author = data.author;
  if (typeof data.date === "string") doc.meta.date = data.date;

  if (data.page && typeof data.page === "object") {
    const p = data.page as Record<string, unknown>;
    doc.meta.page = {};
    if (typeof p.size === "string") doc.meta.page.size = p.size;
    if (typeof p.margin === "string") doc.meta.page.margin = p.margin;
    if (typeof p.orientation === "string") doc.meta.page.orientation = p.orientation;
  }

  if (data.styles && typeof data.styles === "object") {
    doc.meta.styles = data.styles as Record<string, StyleDef>;
  }

  for (const [k, v] of Object.entries(data)) {
    if (!["title", "author", "date", "page", "styles"].includes(k)) {
      doc.meta[k] = v;
    }
  }
}
