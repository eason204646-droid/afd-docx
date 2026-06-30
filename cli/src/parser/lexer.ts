/**
 * AFD Lexer — tokenizes raw .afd text into lines with metadata.
 */

export type LineType =
  | "comment"
  | "frontmatter-start"
  | "frontmatter-end"
  | "frontmatter-line"
  | "heading"
  | "paragraph"
  | "unordered-list-start"
  | "ordered-list-start"
  | "checklist-start"
  | "list-end"
  | "unordered-item"
  | "ordered-item"
  | "checklist-item"
  | "table-start"
  | "table-row"
  | "table-end"
  | "image"
  | "image-caption"
  | "image-width"
  | "image-pos"
  | "code-start"
  | "code-line"
  | "code-end"
  | "page-break"
  | "header-line"
  | "footer-line"
  | "raw-start"
  | "raw-line"
  | "raw-end"
  | "empty"
  | "unclosed-block";

export interface Token {
  type: LineType;
  raw: string;
  value: string; // trimmed content after marker
  lineNumber: number;
}

const H_PREFIX = /^(h[1-6]):\s*/;
const UL_PREFIX = /^ul:\s*$/;
const OL_PREFIX = /^ol:\s*$/;
const CL_PREFIX = /^cl:\s*$/;
const TBL_PREFIX = /^tbl:\s*(.*)$/;
const CODE_PREFIX = /^code:\s*(.*)$/;
const RAW_PREFIX = /^raw:\s*(.*)$/;

export function tokenize(source: string): Token[] {
  const lines = source.split(/\r?\n/);
  const tokens: Token[] = [];
  let inFrontMatter = false;
  let inCodeBlock = false;
  let inRawBlock = false;
  let inList = false;
  let inTable = false;

  let seenContentBefore = false;

  const MALFORMED_PREFIX = /^(h[1-6]|p|img|cap|w|pos|hdr|ftr|br)[^:\s]/;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNumber = i + 1;
    const trimmed = raw.trim();

    // Empty line before frontmatter — skip (don't mark seenContentBefore)
    if (trimmed === "" && !inFrontMatter) {
      tokens.push({ type: "empty", raw, value: "", lineNumber });
      continue;
    }

    // Comment — skip (don't mark seenContentBefore)
    if (trimmed.startsWith("; ") && !inFrontMatter) {
      tokens.push({ type: "comment", raw, value: trimmed.slice(2), lineNumber });
      continue;
    }

    // Handle front matter state — only before any real content
    if (trimmed === "---" && !inFrontMatter && !seenContentBefore) {
      // Check if this is really a front matter start (next line should be YAML)
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (nextLine && !nextLine.startsWith("-") && !nextLine.startsWith(";")) {
        inFrontMatter = true;
        tokens.push({ type: "frontmatter-start", raw, value: "", lineNumber });
        continue;
      }
    }
    if (trimmed === "---" && inFrontMatter) {
      inFrontMatter = false;
      seenContentBefore = true;
      tokens.push({ type: "frontmatter-end", raw, value: "", lineNumber });
      continue;
    }
    if (inFrontMatter) {
      tokens.push({ type: "frontmatter-line", raw, value: raw, lineNumber });
      continue;
    }

    // Code block content
    if (inCodeBlock) {
      if (trimmed === "end") {
        inCodeBlock = false;
        tokens.push({ type: "code-end", raw, value: "", lineNumber });
      } else {
        tokens.push({ type: "code-line", raw, value: raw, lineNumber });
      }
      continue;
    }

    // Raw block content
    if (inRawBlock) {
      if (trimmed === "end") {
        inRawBlock = false;
        tokens.push({ type: "raw-end", raw, value: "", lineNumber });
      } else {
        tokens.push({ type: "raw-line", raw, value: raw, lineNumber });
      }
      continue;
    }

    // Page break
    if (trimmed === "br") {
      tokens.push({ type: "page-break", raw, value: "", lineNumber });
      continue;
    }

    // Heading
    const hMatch = trimmed.match(H_PREFIX);
    if (hMatch) {
      tokens.push({ type: "heading", raw, value: trimmed.slice(hMatch[0].length), lineNumber });
      continue;
    }

    // Paragraph
    if (trimmed.startsWith("p: ")) {
      tokens.push({ type: "paragraph", raw, value: trimmed.slice(3), lineNumber });
      continue;
    }

    // Unordered list start
    if (trimmed.match(UL_PREFIX)) {
      inList = true;
      tokens.push({ type: "unordered-list-start", raw, value: "", lineNumber });
      continue;
    }

    // Ordered list start
    if (trimmed.match(OL_PREFIX)) {
      inList = true;
      tokens.push({ type: "ordered-list-start", raw, value: "", lineNumber });
      continue;
    }

    // Checklist start
    if (trimmed.match(CL_PREFIX)) {
      inList = true;
      tokens.push({ type: "checklist-start", raw, value: "", lineNumber });
      continue;
    }

    // List items (only if in list)
    if (inList) {
      if (trimmed === "end") {
        inList = false;
        tokens.push({ type: "list-end", raw, value: "", lineNumber });
        continue;
      }
      if (trimmed.startsWith("- ")) {
        tokens.push({ type: "unordered-item", raw, value: trimmed.slice(2), lineNumber });
        continue;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        tokens.push({ type: "ordered-item", raw, value: trimmed.replace(/^\d+\.\s*/, ""), lineNumber });
        continue;
      }
      if (trimmed.startsWith("[x] ") || trimmed.startsWith("[ ] ")) {
        tokens.push({ type: "checklist-item", raw, value: trimmed, lineNumber });
        continue;
      }
    }

    // Table
    const tblMatch = trimmed.match(TBL_PREFIX);
    if (tblMatch) {
      inTable = true;
      tokens.push({ type: "table-start", raw, value: tblMatch[1]?.trim() || "", lineNumber });
      continue;
    }
    if (inTable) {
      if (trimmed === "end") {
        inTable = false;
        tokens.push({ type: "table-end", raw, value: "", lineNumber });
        continue;
      }
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        tokens.push({ type: "table-row", raw, value: trimmed, lineNumber });
        continue;
      }
    }

    // Image (supports inline props on same line)
    if (/^img:\s/.test(trimmed)) {
      let value = trimmed.replace(/^img:\s*/, "");

      const stripProp = (prefix: string): string | undefined => {
        const re = new RegExp(`\\s+${prefix}:\\s*(.*?)(?:\\s+(?:cap|w|pos):|\\s*$)`);
        const m = value.match(re);
        if (m && m.index !== undefined) {
          const result = m[1].trim();
          value = value.slice(0, m.index) + value.slice(m.index + m[0].length);
          return result;
        }
        return undefined;
      };
      const inlinePos = stripProp("pos");
      const inlineW = stripProp("w");
      const inlineCap = stripProp("cap");

      value = value.trim();
      tokens.push({ type: "image", raw, value, lineNumber });
      if (inlineCap) tokens.push({ type: "image-caption", raw: "", value: inlineCap, lineNumber });
      if (inlineW) tokens.push({ type: "image-width", raw: "", value: inlineW, lineNumber });
      if (inlinePos) tokens.push({ type: "image-pos", raw: "", value: inlinePos, lineNumber });
      continue;
    }
    if (trimmed.startsWith("cap: ")) {
      tokens.push({ type: "image-caption", raw, value: trimmed.slice(5), lineNumber });
      continue;
    }
    if (trimmed.startsWith("w: ")) {
      tokens.push({ type: "image-width", raw, value: trimmed.slice(3), lineNumber });
      continue;
    }
    if (trimmed.startsWith("pos: ")) {
      tokens.push({ type: "image-pos", raw, value: trimmed.slice(5), lineNumber });
      continue;
    }

    // Code block start
    const codeMatch = trimmed.match(CODE_PREFIX);
    if (codeMatch) {
      inCodeBlock = true;
      tokens.push({ type: "code-start", raw, value: codeMatch[1] || "", lineNumber });
      continue;
    }

    // Raw block start
    const rawMatch = trimmed.match(RAW_PREFIX);
    if (rawMatch) {
      inRawBlock = true;
      tokens.push({ type: "raw-start", raw, value: rawMatch[1] || "", lineNumber });
      continue;
    }

    // Header / footer
    if (trimmed.startsWith("hdr: ")) {
      tokens.push({ type: "header-line", raw, value: trimmed.slice(5), lineNumber });
      continue;
    }
    if (trimmed.startsWith("ftr: ")) {
      tokens.push({ type: "footer-line", raw, value: trimmed.slice(5), lineNumber });
      continue;
    }

    // Fallback: treat as paragraph
    if (MALFORMED_PREFIX.test(trimmed)) {
      tokens.push({ type: "comment", raw, value: `[syntax warning] '${trimmed}' — missing colon?`, lineNumber });
    } else {
      tokens.push({ type: "paragraph", raw, value: trimmed, lineNumber });
    }
  }

  if (inFrontMatter) {
    tokens.push({ type: "unclosed-block", raw: "", value: "Unclosed front matter (missing closing ---)", lineNumber: lines.length });
  }
  if (inCodeBlock) {
    tokens.push({ type: "unclosed-block", raw: "", value: "Unclosed code block (missing 'end')", lineNumber: lines.length });
  }
  if (inRawBlock) {
    tokens.push({ type: "unclosed-block", raw: "", value: "Unclosed raw block (missing 'end')", lineNumber: lines.length });
  }
  if (inList) {
    tokens.push({ type: "unclosed-block", raw: "", value: "Unclosed list (missing 'end')", lineNumber: lines.length });
  }
  if (inTable) {
    tokens.push({ type: "unclosed-block", raw: "", value: "Unclosed table (missing 'end')", lineNumber: lines.length });
  }

  return tokens;
}
