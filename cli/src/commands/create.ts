import * as fs from "fs";
import * as path from "path";
import { parse } from "../parser/index.js";
import { exportDocx } from "../converter/index.js";

interface CreateOptions {
  template?: string;
  title?: string;
  author?: string;
  content?: string;
  force?: boolean;
  noExport?: boolean;
}

const TEMPLATES: Record<string, string> = {
  doc: `; AFD v1
---
title: "Untitled Document"
author: "AI Assistant"
date: ""
page:
  size: A4
  margin: 2.54cm
styles:
  h1:
    size: 24
    bold: true
  h2:
    size: 18
    bold: true
  normal:
    size: 11
    line-height: 1.5
---

h1: Title
p: Start writing here.
`,

  report: `; AFD v1
---
title: "Report Title"
author: "Author"
date: ""
page:
  size: A4
  margin: 2.5cm
---

h1: Executive Summary
p: This report covers...

h2: Background
p: Provide context here.

h2: Analysis
tbl: bordered header
| Metric | Value | Change |
|  |  |  |
end

h2: Conclusion
p: Summarize findings.
`,

  presentation: `; AFD v1
---
title: "Presentation Title"
author: "Author"
theme: modern
page:
  size: widescreen
---

slide: title
p: **Presentation Title**
p: Subtitle

slide: content
h1: Agenda
ul:
- Topic 1
- Topic 2
- Topic 3
end

slide: content
h1: Key Point
p: Content here.

slide: end
p: **Thank You**
`,

  spreadsheet: `; AFD v1
---
title: "Spreadsheet Title"
---

sheet: Sheet1
cols: 4
tbl: bordered header
| Item | Category | Value | Notes |
|  |  |  |  |
end
`,
};

export async function createCommand(args: string[], options: CreateOptions): Promise<void> {
  const filePath = args[0];
  if (!filePath) {
    console.error("Usage: afd create <file.afd> [--template doc|report|presentation|spreadsheet] [--title ...] [--author ...] [--content ...] [--force] [--no-export]");
    process.exit(1);
    return;
  }

  if (fs.existsSync(filePath) && !options.force) {
    console.error(`Error: ${filePath} already exists (use --force to overwrite)`);
    process.exit(1);
    return;
  }

  const templateName = options.template || "doc";
  let content = TEMPLATES[templateName];

  if (!content) {
    console.error(`Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(", ")}`);
    process.exit(1);
    return;
  }

  if (options.title) {
    content = content.replace(/title: ".*?"/, `title: ${JSON.stringify(options.title)}`);
  }
  if (options.author) {
    content = content.replace(/author: ".*?"/, `author: ${JSON.stringify(options.author)}`);
  }

  // Content sources (priority: --content > stdin > template body)
  const body = options.content || readStdin();
  if (body) {
    content = injectBody(content, mdToAfd(body));
  }

  const dir = path.dirname(filePath);
  if (dir && dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`Created ${filePath} (${templateName} template)`);

  if (!options.noExport) {
    const source = fs.readFileSync(filePath, "utf-8");
    const result = parse(source);
    const baseName = path.basename(filePath, path.extname(filePath));
    const docxPath = path.join(dir, `${baseName}.docx`);
    await exportDocx(result.document, docxPath, dir);
    console.log(`Auto-exported to ${docxPath}`);
  }
}

function readStdin(): string | null {
  try {
    if (process.stdin.isTTY) return null;
    const buf = fs.readFileSync(0, "utf-8");
    return buf || null;
  } catch {
    return null;
  }
}

function injectBody(template: string, body: string): string {
  const idx = template.indexOf("\n\n");
  if (idx !== -1) {
    return template.slice(0, idx + 2) + body.trimStart();
  }
  return template + "\n" + body;
}

/** Convert Markdown or plain text to AFD format */
function mdToAfd(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Blank line
    if (!trimmed) {
      out.push("");
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      out.push(lang ? `code: ${lang}` : "code: text");
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        out.push(lines[i]);
        i++;
      }
      out.push("end");
      if (i < lines.length) i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      out.push("cl:");
      while (i < lines.length) {
        const t = lines[i].trimStart();
        if (t.startsWith("> ")) {
          out.push("- " + t.slice(2));
          i++;
        } else if (t === ">") {
          i++;
        } else {
          break;
        }
      }
      out.push("end");
      continue;
    }

    // ATX headings: # through ######
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`h${level}: ${hMatch[2]}`);
      i++;
      continue;
    }

    // Unordered list: detect continuous - items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      out.push("ul:");
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.startsWith("- ") || t.startsWith("* ")) {
          out.push("- " + t.slice(2));
          i++;
        } else {
          break;
        }
      }
      out.push("end");
      continue;
    }

    // Ordered list: detect continuous 1. 2. items
    if (/^\d+\.\s/.test(trimmed)) {
      out.push("ol:");
      while (i < lines.length) {
        const t = lines[i].trim();
        const olMatch = t.match(/^\d+\.\s+(.*)$/);
        if (olMatch) {
          out.push("1. " + olMatch[1]);
          i++;
        } else {
          break;
        }
      }
      out.push("end");
      continue;
    }

    // Thematic break
    if (/^[-*_]{3,}$/.test(trimmed)) {
      out.push("br");
      i++;
      continue;
    }

    // Paragraph
    out.push("p: " + trimmed);
    i++;
  }

  return out.join("\n");
}
