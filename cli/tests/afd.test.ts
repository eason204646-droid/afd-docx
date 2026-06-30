import { describe, it, expect } from "vitest";
import { parse, parseInline } from "../src/parser/index.js";
import { exportMarkdown } from "../src/converter/md-writer.js";
import { formatDocument } from "../src/formatter/fmt.js";
import { Document, Inline, Block } from "../src/model/types.js";
import { createCommand } from "../src/commands/create.js";

/* ── Inline Parsing ── */

describe("parseInline", () => {
  it("parses plain text", () => {
    expect(parseInline("hello world")).toEqual([
      { type: "text", text: "hello world" },
    ]);
  });

  it("parses bold text", () => {
    expect(parseInline("**bold**")).toEqual([
      { type: "bold", text: [{ type: "text", text: "bold" }] },
    ]);
  });

  it("parses italic text", () => {
    expect(parseInline("*italic*")).toEqual([
      { type: "italic", text: [{ type: "text", text: "italic" }] },
    ]);
  });

  it("parses mixed inline", () => {
    const result = parseInline("**bold** and *italic*");
    expect(result).toEqual([
      { type: "bold", text: [{ type: "text", text: "bold" }] },
      { type: "text", text: " and " },
      { type: "italic", text: [{ type: "text", text: "italic" }] },
    ]);
  });

  it("parses code spans", () => {
    expect(parseInline("use `code` here")).toEqual([
      { type: "text", text: "use " },
      { type: "code", text: "code" },
      { type: "text", text: " here" },
    ]);
  });

  it("parses links", () => {
    expect(parseInline("[link](url)")).toEqual([
      { type: "link", text: "link", url: "url" },
    ]);
  });

  it("parses strikethrough", () => {
    expect(parseInline("~~strike~~")).toEqual([
      { type: "strikethrough", text: [{ type: "text", text: "strike" }] },
    ]);
  });

  it("handles escaped bold markers", () => {
    expect(parseInline("\\*\\*not bold\\*\\*")).toEqual([
      { type: "text", text: "**not bold**" },
    ]);
  });

  it("handles escaped italic markers", () => {
    expect(parseInline("\\*not italic\\*")).toEqual([
      { type: "text", text: "*not italic*" },
    ]);
  });

  it("handles escaped backtick", () => {
    expect(parseInline("\\`not code\\`")).toEqual([
      { type: "text", text: "`not code`" },
    ]);
  });

  it("mixes escaped and real formatting", () => {
    expect(parseInline("escaped \\*\\*bold\\*\\* + **real**")).toEqual([
      { type: "text", text: "escaped **bold** + " },
      { type: "bold", text: [{ type: "text", text: "real" }] },
    ]);
  });
});

/* ── Document Parsing ── */

describe("parse", () => {
  it("parses headings", () => {
    const result = parse("h1: Hello\nh2: World\n");
    expect(result.errors).toHaveLength(0);
    expect(result.document.content).toHaveLength(2);
    expect(result.document.content[0]).toMatchObject({ type: "heading", level: 1 });
    expect(result.document.content[1]).toMatchObject({ type: "heading", level: 2 });
  });

  it("parses paragraphs", () => {
    const result = parse("p: First paragraph\np: Second paragraph\n");
    expect(result.document.content).toHaveLength(2);
    expect(result.document.content[0]).toMatchObject({ type: "paragraph" });
  });

  it("parses front matter", () => {
    const result = parse('---\ntitle: Test\nauthor: Me\n---\nh1: Hello\n');
    expect(result.document.meta.title).toBe("Test");
    expect(result.document.meta.author).toBe("Me");
  });

  it("parses unordered list", () => {
    const result = parse("ul:\n- Item A\n- Item B\nend\n");
    expect(result.document.content[0]).toMatchObject({ type: "unordered-list" });
  });

  it("parses ordered list", () => {
    const result = parse("ol:\n1. First\n2. Second\nend\n");
    expect(result.document.content[0]).toMatchObject({ type: "ordered-list" });
  });

  it("parses checklist", () => {
    const result = parse("cl:\n[x] Done\n[ ] Pending\nend\n");
    expect(result.document.content[0]).toMatchObject({ type: "checklist" });
  });

  it("parses table", () => {
    const result = parse("tbl: bordered header\n| A | B |\n| 1 | 2 |\nend\n");
    expect(result.document.content[0]).toMatchObject({ type: "table" });
  });

  it("parses table with column widths", () => {
    const result = parse("tbl: bordered header cols:30%,30%,40%\n| A | B | C |\n| 1 | 2 | 3 |\nend\n");
    const table = result.document.content[0];
    expect(table).toMatchObject({ type: "table" });
    if (table.type === "table") {
      expect(table.columnWidths).toEqual(["30%", "30%", "40%"]);
    }
  });

  it("round-trips table with column widths", () => {
    const src = "tbl: bordered header cols:30%,30%,40%\n| A | B | C |\nend\n";
    const result = parse(src);
    const formatted = formatDocument(result.document);
    expect(formatted).toContain("cols:30%,30%,40%");
    const result2 = parse(formatted);
    expect(result2.errors).toHaveLength(0);
  });

  it("parses code block", () => {
    const result = parse("code: js\nconsole.log('hi');\nend\n");
    expect(result.document.content[0]).toMatchObject({ type: "code", lang: "js" });
  });

  it("parses image with caption", () => {
    const result = parse("img: photo.png\ncap: A photo\nw: 50%\n");
    expect(result.document.content[0]).toMatchObject({ type: "image", src: "photo.png", caption: "A photo", width: "50%" });
  });

  it("parses image with inline props on same line", () => {
    const result = parse('img: photo.png cap: My Photo w: 80% pos: center\n');
    expect(result.document.content[0]).toMatchObject({
      type: "image", src: "photo.png", caption: "My Photo", width: "80%", position: "center",
    });
  });

  it("parses header and footer", () => {
    const result = parse("hdr: Header Text\nftr: Footer Text\nh1: Title\n");
    expect(result.document.header).toBe("Header Text");
    expect(result.document.footer).toBe("Footer Text");
  });

  it("parses header/footer with inline formatting", () => {
    const result = parse("hdr: **Bold** and *italic*\nftr: Page @PAGE\nh1: Title\n");
    expect(result.document.header).toBe("**Bold** and *italic*");
    expect(result.document.footer).toBe("Page @PAGE");
  });

  it("parses page break", () => {
    const result = parse("h1: Before\nbr\nh1: After\n");
    expect(result.document.content).toHaveLength(3);
    expect(result.document.content[1]).toMatchObject({ type: "page-break" });
  });

  it("handles comments", () => {
    const result = parse("; this is a comment\nh1: Title\n");
    expect(result.errors).toHaveLength(0);
    expect(result.document.content).toHaveLength(1);
  });
});

/* ── Markdown Export ── */

describe("exportMarkdown", () => {
  it("exports headings", () => {
    const doc: Document = {
      version: 1, meta: {},
      content: [{ type: "heading", level: 1, text: [{ type: "text", text: "Title" }] }],
    };
    const md = exportMarkdown(doc);
    expect(md).toContain("# Title");
  });

  it("exports bold and italic", () => {
    const doc: Document = {
      version: 1, meta: {},
      content: [{ type: "paragraph", text: [{ type: "bold", text: [{ type: "text", text: "bold" }] }, { type: "text", text: " and " }, { type: "italic", text: [{ type: "text", text: "italic" }] }] }],
    };
    const md = exportMarkdown(doc);
    expect(md).toContain("**bold**");
    expect(md).toContain("*italic*");
  });
});

/* ── Format Document ── */

describe("formatDocument", () => {
  it("produces valid AFD output", () => {
    const doc: Document = {
      version: 1, meta: { title: "Test" },
      content: [{ type: "heading", level: 1, text: [{ type: "text", text: "Hello" }] }],
    };
    const afd = formatDocument(doc);
    expect(afd).toContain("; AFD v1");
    expect(afd).toContain("h1: Hello");
  });

  it("round-trips through parse", () => {
    const doc: Document = {
      version: 1, meta: { title: "Round", author: "Trip" },
      content: [
        { type: "heading", level: 1, text: [{ type: "text", text: "Title" }] },
        { type: "paragraph", text: [{ type: "bold", text: [{ type: "text", text: "bold" }] }] },
        { type: "unordered-list", items: [{ text: [{ type: "text", text: "A" }] }, { text: [{ type: "text", text: "B" }] }] },
      ],
    };
    const afd = formatDocument(doc);
    const result = parse(afd);
    expect(result.errors).toHaveLength(0);
    expect(result.document.meta.title).toBe("Round");
    expect(result.document.content).toHaveLength(3);
  });
});

/* ── End-to-end from examples ── */

describe("example files", () => {
  const fs = require("fs");
  const path = require("path");
  const examplesDir = path.resolve(__dirname, "..", "..", "examples");
  const examples = ["hello.afd", "report.afd", "presentation.afd", "spreadsheet.afd"];

  for (const file of examples) {
    it(`parses ${file} without errors`, () => {
      const content = fs.readFileSync(path.join(examplesDir, file), "utf-8");
      const result = parse(content);
      expect(result.errors).toHaveLength(0);
      expect(result.document.content.length).toBeGreaterThan(0);
    });

    it(`exports ${file} to markdown`, () => {
      const content = fs.readFileSync(path.join(examplesDir, file), "utf-8");
      const result = parse(content);
      const md = exportMarkdown(result.document);
      expect(md.length).toBeGreaterThan(0);
    });

    it(`round-trips ${file} through formatDocument`, () => {
      const content = fs.readFileSync(path.join(examplesDir, file), "utf-8");
      const result = parse(content);
      const formatted = formatDocument(result.document);
      const result2 = parse(formatted);
      expect(result2.errors).toHaveLength(0);
      expect(result2.document.content.length).toBe(result.document.content.length);
    });
  }

  it("exports hello.afd to docx without error", async () => {
    const { exportDocx } = await import("../src/converter/docx-writer.js");
    const content = fs.readFileSync(path.join(examplesDir, "hello.afd"), "utf-8");
    const result = parse(content);
    const tmpPath = "tests/fixtures/test-export.docx";
    await exportDocx(result.document, tmpPath, examplesDir);
    const exists = fs.existsSync(tmpPath);
    if (exists) fs.unlinkSync(tmpPath);
    expect(exists).toBe(true);
  });

  it("exports hello.afd to docx and imports back", async () => {
    const { exportDocx } = await import("../src/converter/docx-writer.js");
    const { importDocx } = await import("../src/converter/docx-reader.js");
    const content = fs.readFileSync(path.join(examplesDir, "hello.afd"), "utf-8");
    const result = parse(content);
    const tmpPath = "tests/fixtures/test-roundtrip.docx";
    await exportDocx(result.document, tmpPath, examplesDir);
    expect(fs.existsSync(tmpPath)).toBe(true);
    const doc = await importDocx(tmpPath);
    expect(doc.content.length).toBeGreaterThan(0);
    fs.unlinkSync(tmpPath);
  });
});

/* ── Header/Footer with inline formatting ── */

describe("header/footer inline formatting", () => {
  it("round-trips header with bold/italic through formatDocument", () => {
    const result = parse("hdr: **Bold** and *italic*\np: Hello\n");
    const formatted = formatDocument(result.document);
    expect(formatted).toContain("hdr: **Bold** and *italic*");
    const result2 = parse(formatted);
    expect(result2.errors).toHaveLength(0);
    expect(result2.document.header).toBe("**Bold** and *italic*");
  });

  it("round-trips footer with @PAGE through formatDocument", () => {
    const result = parse("ftr: Page @PAGE of @TOTAL_PAGES\np: Content\n");
    const formatted = formatDocument(result.document);
    expect(formatted).toContain("ftr: Page @PAGE of @TOTAL_PAGES");
    const result2 = parse(formatted);
    expect(result2.errors).toHaveLength(0);
    expect(result2.document.footer).toBe("Page @PAGE of @TOTAL_PAGES");
  });
});

/* ── Edit Command DOCX Round-trip ── */

describe("edit round-trip", () => {
  const fs = require("fs");
  const path = require("path");
  const examplesDir = path.resolve(__dirname, "..", "..", "examples");

  it("creates afd from docx back and forth", async () => {
    const { exportDocx } = await import("../src/converter/docx-writer.js");
    const { importDocx } = await import("../src/converter/docx-reader.js");

    const original: Document = {
      version: 1, meta: { title: "EditTest" },
      content: [
        { type: "heading", level: 1, text: [{ type: "text", text: "Round-trip" }] },
        { type: "paragraph", text: [{ type: "text", text: "Hello from edit test" }] },
      ],
    };
    const tmpDocx = "tests/fixtures/test-edit-roundtrip.docx";
    await exportDocx(original, tmpDocx, examplesDir);

    const imported = await importDocx(tmpDocx);
    const afdOut = formatDocument(imported);
    const parsed = parse(afdOut);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.document.content.length).toBeGreaterThan(0);

    if (fs.existsSync(tmpDocx)) fs.unlinkSync(tmpDocx);
  });
});

/* ── Create with --content ── */

describe("create --content", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  it("injects body content into template", () => {
    const tmpFile = path.join(os.tmpdir(), `afd-test-content-${Date.now()}.afd`);

    try {
      createCommand([tmpFile], { content: "h1: Custom\np: Body text" });
      expect(fs.existsSync(tmpFile)).toBe(true);
      const content = fs.readFileSync(tmpFile, "utf-8");
      expect(content).toContain("h1: Custom");
      expect(content).toContain("p: Body text");
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it("rejects unknown template", async () => {
    await expect(
      createCommand(["test.afd"], { template: "nonexistent" })
    ).rejects.toThrow("Unknown template: nonexistent");
  });
});

/* ── Markdown → AFD conversion ── */

describe("mdToAfd conversion via --content", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  function testFile(content: string): string {
    const tmpFile = path.join(os.tmpdir(), `afd-md-test-${Date.now()}.afd`);
    createCommand([tmpFile], { content });
    const text = fs.readFileSync(tmpFile, "utf-8");
    fs.unlinkSync(tmpFile);
    return text;
  }

  it("converts ATX headings", () => {
    const result = testFile("# H1\n## H2\n### H3");
    expect(result).toContain("h1: H1");
    expect(result).toContain("h2: H2");
    expect(result).toContain("h3: H3");
  });

  it("converts paragraphs", () => {
    const result = testFile("First paragraph.\n\nSecond paragraph.");
    expect(result).toContain("p: First paragraph.");
    expect(result).toContain("p: Second paragraph.");
  });

  it("converts unordered lists", () => {
    const result = testFile("- Item A\n- Item B\n- Item C");
    expect(result).toContain("ul:");
    expect(result).toContain("- Item A");
    expect(result).toContain("end");
  });

  it("converts ordered lists", () => {
    const result = testFile("1. First\n2. Second\n3. Third");
    expect(result).toContain("ol:");
    expect(result).toContain("1. First");
    expect(result).toContain("end");
  });

  it("passes through raw AFD markers without p: prefix", () => {
    const result = testFile("ul:\n- item A\n- item B\nend");
    expect(result).toContain("ul:");
    expect(result).toContain("end");
    expect(result).not.toContain("p: ul:");
    expect(result).not.toContain("p: end");
  });

  it("produces valid AFD", () => {
    const result = testFile("# Hello\n\nThis is a test.\n\n- Item 1\n- Item 2\n\n1. One\n2. Two");
    const parsed = parse(result);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.document.content.length).toBe(4);
    expect(parsed.document.content[0].type).toBe("heading");
    expect(parsed.document.content[1].type).toBe("paragraph");
    expect(parsed.document.content[2].type).toBe("unordered-list");
    expect(parsed.document.content[3].type).toBe("ordered-list");
  });
});
