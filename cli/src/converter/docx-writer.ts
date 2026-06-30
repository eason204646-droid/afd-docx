import {
  Document as DocxDocument, Packer, Paragraph, TextRun, Table, TableRow,
  TableCell as DocxCell, HeadingLevel, AlignmentType, WidthType,
  PageBreak, Header as DocxHeader, Footer as DocxFooter,
  ShadingType, ExternalHyperlink, LevelFormat, ImageRun,
  BorderStyle, ISectionOptions, PageNumber,
} from "docx";
import { parseInline } from "../parser/index.js";
import * as fs from "fs";
import * as path from "path";
import { Document, Inline, Block, StyleDef } from "../model/types.js";

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const NAMED_COLORS: Record<string, string> = {
  red: "FF0000", maroon: "800000", darkred: "8B0000",
  green: "008000", lime: "00FF00", darkgreen: "006400",
  blue: "0000FF", navy: "000080", darkblue: "00008B",
  cyan: "00FFFF", teal: "008080",
  magenta: "FF00FF", purple: "800080", fuchsia: "FF00FF",
  yellow: "FFFF00", olive: "808000",
  orange: "FFA500", darkorange: "FF8C00",
  pink: "FFC0CB", hotpink: "FF69B4",
  white: "FFFFFF", black: "000000", gray: "808080", grey: "808080",
  silver: "C0C0C0", lightgray: "D3D3D3", darkgray: "A9A9A9",
  brown: "A52A2A", gold: "FFD700", violet: "EE82EE",
  indigo: "4B0082", coral: "FF7F50", salmon: "FA8072",
  khaki: "F0E68C", turquoise: "40E0D0", plum: "DDA0DD",
  wheat: "F5DEB3", linen: "FAF0E6", ivory: "FFFFF0",
};

const IMAGE_FORMATS: Record<string, string> = {
  ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg",
  ".gif": "gif", ".bmp": "bmp", ".webp": "webp",
};

const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };
const BORDER_THIN = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const CELL_BORDERS = {
  top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN,
};

/* ── Public API ── */

export async function exportDocx(doc: Document, outputPath: string, baseDir: string = "."): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  const hasOrderedList = doc.content.some(b => b.type === "ordered-list");
  const hasUnorderedList = doc.content.some(b => b.type === "unordered-list");

  const contentWidth = getContentWidth(doc.meta.page?.size, doc.meta.page?.orientation, doc.meta.page?.margin);
  const styles = doc.meta.styles || {};

  for (const block of doc.content) {
    const elements = blockToDocx(block, baseDir, contentWidth, styles);
    children.push(...elements);
  }

  const marginEmu = marginToTwip(doc.meta.page?.margin || "2.54cm");

  const section: ISectionOptions = {
    properties: {
      page: {
        size: getPageSize(doc.meta.page?.size, doc.meta.page?.orientation),
        margin: {
          top: marginEmu, bottom: marginEmu, left: marginEmu, right: marginEmu,
        },
      },
    },
    children,
  } as ISectionOptions;

  const hfProps = { size: 18, font: "Inter" };
  if (doc.header) {
    const parts = splitHeaderFooter(doc.header);
    const headerChildren: Paragraph[] = [];
    if (parts[0]) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: renderHeaderFooterText(parts[0], hfProps),
      }));
    }
    if (parts[1]) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: renderHeaderFooterText(parts[1], hfProps),
      }));
    }
    if (parts[2]) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: renderHeaderFooterText(parts[2], hfProps),
      }));
    }
    (section as unknown as Record<string, unknown>).headers = {
      default: new DocxHeader({ children: headerChildren }),
    };
  }

  if (doc.footer) {
    const parts = splitHeaderFooter(doc.footer);
    const footerChildren: Paragraph[] = [];
    if (parts[0]) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: renderHeaderFooterText(parts[0], hfProps),
      }));
    }
    if (parts.length > 1 && parts[1]) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: renderHeaderFooterText(parts[1], hfProps),
      }));
    }
    if (parts.length > 2 && parts[2]) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: renderHeaderFooterText(parts[2], hfProps),
      }));
    }
    (section as unknown as Record<string, unknown>).footers = {
      default: new DocxFooter({ children: footerChildren }),
    };
  }

  const sections: ISectionOptions[] = [section];

  const numbering = hasOrderedList || hasUnorderedList ? {
    config: [
      ...(hasOrderedList ? [{
        reference: "ordered-list",
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 }
            }
          }
        }]
      }] : []),
      ...(hasUnorderedList ? [{
        reference: "bullet-list",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 }
            }
          }
        }]
      }] : []),
    ],
  } : undefined;

  const docxDoc = new DocxDocument({ sections, numbering });
  const buffer = await Packer.toBuffer(docxDoc);
  fs.writeFileSync(outputPath, buffer);
}

/* ── Inline formatting with recursive nested support ── */

interface RunProps {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  size?: number;
  font?: string;
  color?: string;
}

export function inlineToRuns(inlines: Inline[], inherited: RunProps = {}): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  for (const inline of inlines) {
    switch (inline.type) {
      case "text":
        runs.push(new TextRun({ text: inline.text, ...inherited }));
        break;
      case "bold":
        runs.push(...inlineToRuns(inline.text, { ...inherited, bold: true }));
        break;
      case "italic":
        runs.push(...inlineToRuns(inline.text, { ...inherited, italic: true }));
        break;
      case "strikethrough":
        runs.push(...inlineToRuns(inline.text, { ...inherited, strike: true }));
        break;
      case "code":
        runs.push(new TextRun({
          text: inline.text,
          font: inherited.font || "Consolas",
          size: inherited.size || 20,
          color: "E83E8C",
          ...inherited,
        }));
        break;
      case "link":
        runs.push(new ExternalHyperlink({
          children: [new TextRun({ text: inline.text, style: "Hyperlink", ...inherited })],
          link: inline.url,
        }));
        break;
      case "colored": {
        const hexColor = normalizeColor(inline.color);
        runs.push(...inlineToRuns(inline.text, { ...inherited, color: hexColor }));
        break;
      }
    }
  }
  return runs;
}

/* ── Block → docx elements ── */

function blockToDocx(
  block: Block, baseDir: string, contentWidth: number, styles: Record<string, StyleDef> = {},
): (Paragraph | Table)[] {
  switch (block.type) {
    case "heading": {
      const style = styles[`h${block.level}`];
      const props: RunProps = {
        size: style?.size != null ? style.size * 2 : headingDefaultSize(block.level),
        font: style?.font || undefined,
        bold: style?.bold,
        color: style?.color ? normalizeColor(style.color) : undefined,
      };
      return [new Paragraph({
        heading: HEADING_MAP[block.level],
        spacing: { before: 240, after: 120 },
        children: inlineToRuns(block.text, props),
      })];
    }

    case "paragraph": {
      const style = styles["normal"];
      const props: RunProps = {
        size: style?.size != null ? style.size * 2 : undefined,
        font: style?.font || undefined,
        color: style?.color ? normalizeColor(style.color) : undefined,
      };
      return [new Paragraph({
        spacing: { after: 120 },
        children: inlineToRuns(block.text, props),
      })];
    }

    case "unordered-list":
      return block.items.map(item =>
        new Paragraph({
          numbering: { reference: "bullet-list", level: 0 },
          spacing: { after: 60 },
          children: inlineToRuns(item.text),
        })
      );

    case "ordered-list":
      return block.items.map(item =>
        new Paragraph({
          numbering: { reference: "ordered-list", level: 0 },
          spacing: { after: 60 },
          children: inlineToRuns(item.text),
        })
      );

    case "checklist":
      return block.items.map(item => {
        const prefix = item.checked ? "☑ " : "☐ ";
        return new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: prefix }), ...inlineToRuns(item.text)],
        });
      });

    case "table": {
      const colCount = block.rows.length > 0 ? block.rows[0].length : 1;
      let columnWidths: number[];
      if (block.columnWidths && block.columnWidths.length === colCount) {
        columnWidths = block.columnWidths.map(w => parseImageWidth(w, contentWidth));
      } else {
        const colWidth = Math.floor(contentWidth / colCount);
        columnWidths = Array(colCount).fill(colWidth);
      }

      const rows: TableRow[] = block.rows.map((row, rowIdx) => {
        const cells = row.map((cell, colIdx) => {
          const paragraphs = cell.text.length > 0
            ? [new Paragraph({ children: inlineToRuns(cell.text) })]
            : [new Paragraph({ children: [] })];
          return new DocxCell({
            children: paragraphs,
            width: { size: columnWidths[colIdx], type: WidthType.DXA },
            margins: CELL_MARGINS,
            borders: block.bordered ? CELL_BORDERS : undefined,
            shading: block.header && rowIdx === 0
              ? { type: ShadingType.CLEAR as any, fill: "F2F2F2" }
              : undefined,
          });
        });
        return new TableRow({ children: cells });
      });

      return [new Table({ rows, width: { size: contentWidth, type: WidthType.DXA }, columnWidths })];
    }

    case "image": {
      let imagePath = block.src;
      if (!path.isAbsolute(imagePath)) {
        imagePath = path.join(baseDir, imagePath);
      }
      if (!fs.existsSync(imagePath)) {
        return [new Paragraph({
          children: [new TextRun({ text: `[Image not found: ${block.src}]`, italics: true, color: "999999" })],
        })];
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const imageType = IMAGE_FORMATS[ext] || null;

      if (!imageType) {
        return [new Paragraph({
          children: [new TextRun({ text: `[Image: ${block.src}]`, italics: true })],
        })];
      }

      const dims = getImageDimensions(imagePath);
      let imgWidth: number;
      let imgHeight: number;

      if (block.width) {
        imgWidth = parseImageWidth(block.width, contentWidth);
        imgHeight = dims ? Math.round(imgWidth * (dims.height / dims.width)) : Math.round(imgWidth * 0.75);
      } else if (dims) {
        imgWidth = dims.width;
        imgHeight = dims.height;
      } else {
        imgWidth = 400;
        imgHeight = 300;
      }

      const alignment = block.position === "center" ? AlignmentType.CENTER
        : block.position === "right" ? AlignmentType.RIGHT
        : AlignmentType.LEFT;

      return [new Paragraph({
        children: [new ImageRun({
          data: imageBuffer,
          transformation: { width: imgWidth, height: imgHeight },
        })],
        alignment,
      })];
    }

    case "code": {
      const style = styles["code"];
      const lines = block.content.split("\n");
      return lines.map(line =>
        new Paragraph({
          spacing: { after: 0, line: 276 },
          indent: { left: 720 },
          shading: { type: ShadingType.CLEAR as any, fill: "F5F5F5" },
          children: [new TextRun({
            text: line,
            font: style?.font || "Consolas",
            size: style?.size != null ? style.size * 2 : 18,
            color: style?.color ? normalizeColor(style.color) : undefined,
          })],
        })
      );
    }

    case "raw":
      return block.content.split("\n").map(line =>
        new Paragraph({ children: [new TextRun({ text: line })] })
      );

    case "page-break":
      return [new Paragraph({ children: [new PageBreak()] })];

    default:
      return [];
  }
}

/* ── Utils ── */

function headingDefaultSize(level: number): number {
  const sizes: Record<number, number> = { 1: 48, 2: 40, 3: 32, 4: 28, 5: 24, 6: 22 };
  return sizes[level] || 22;
}

function normalizeColor(color: string): string {
  let c = (color || "").trim();
  if (!c) return "000000";
  if (c.startsWith("#")) c = c.slice(1);
  const lower = c.toLowerCase();
  if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
  if (/^[0-9a-f]{3}$/i.test(c)) return c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  if (/^[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  return "000000";
}

function parseImageWidth(width: string, containerPixels: number = 600): number {
  const trimmed = width.trim();
  if (trimmed.endsWith("%")) {
    return Math.round(containerPixels * parseFloat(trimmed) / 100);
  }
  if (trimmed.endsWith("px")) {
    return parseFloat(trimmed);
  }
  if (trimmed.endsWith("cm")) {
    return Math.round(parseFloat(trimmed) * 37.8);
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? containerPixels : Math.round(num);
}

function getImageDimensions(filePath: string): { width: number; height: number } | null {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(512);
  const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
  fs.closeSync(fd);
  if (bytesRead < 24) return null;

  // PNG
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < bytesRead - 9) {
      if (buffer[offset] === 0xFF) {
        const marker = buffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += segLen + 2;
      } else {
        offset++;
      }
    }
    return null;
  }

  // GIF
  if (buffer.toString('ascii', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return { width: buffer.readUInt32LE(18), height: Math.abs(buffer.readInt32LE(22)) };
  }

  // WebP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8 ' && bytesRead >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3FFF,
        height: buffer.readUInt16LE(28) & 0x3FFF,
      };
    }
    if (chunkType === 'VP8L' && bytesRead >= 25) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
    }
    if (chunkType === 'VP8X' && bytesRead >= 30) {
      return {
        width: (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1,
        height: (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1,
      };
    }
  }

  return null;
}

function getPageSize(size?: string, orientation?: string): { width: number; height: number } {
  const sz = (size || "a4").toLowerCase();
  const isLandscape = orientation === "landscape";
  const sizes: Record<string, { width: number; height: number }> = {
    a4: { width: 11906, height: 16838 },
    letter: { width: 12240, height: 15840 },
    a3: { width: 16838, height: 23811 },
    legal: { width: 12240, height: 20160 },
    tabloid: { width: 15840, height: 12240 },
  };
  const s = sizes[sz] || sizes.a4;
  return isLandscape ? { width: s.height, height: s.width } : s;
}

function getContentWidth(pageSize?: string, orientation?: string, margin?: string): number {
  const sz = getPageSize(pageSize, orientation);
  return sz.width - 2 * marginToTwip(margin || "2.54cm");
}

function marginToTwip(margin: string): number {
  const match = margin.match(/^([\d.]+)\s*(cm|mm|in|pt)?$/);
  if (!match) return 1440;
  const val = parseFloat(match[1]);
  const unit = match[2] || "cm";
  switch (unit) {
    case "cm": return Math.round(val * 567);
    case "mm": return Math.round(val * 56.7);
    case "in": return Math.round(val * 1440);
    case "pt": return Math.round(val * 20);
    default: return Math.round(val * 567);
  }
}

function splitHeaderFooter(text: string): string[] {
  const parts = text.split("|").map(s => s.trim());
  return [parts[0] || "", parts[1] || "", parts[2] || ""];
}

function renderHeaderFooterText(text: string, baseProps: RunProps): (TextRun | ExternalHyperlink)[] {
  if (!text.includes("@PAGE") && !text.includes("@TOTAL_PAGES")) {
    return inlineToRuns(parseInline(text), baseProps);
  }
  const parts = text.split(/(@PAGE|@TOTAL_PAGES)/g);
  const runs: (TextRun | ExternalHyperlink)[] = [];
  for (const part of parts) {
    if (part === "@PAGE") {
      runs.push(new TextRun({ children: [PageNumber.CURRENT], ...baseProps }));
    } else if (part === "@TOTAL_PAGES") {
      runs.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], ...baseProps }));
    } else if (part) {
      runs.push(...inlineToRuns(parseInline(part), baseProps));
    }
  }
  return runs;
}
