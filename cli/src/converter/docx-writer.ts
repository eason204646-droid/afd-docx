import {
  Document as DocxDocument, Packer, Paragraph, TextRun, Table, TableRow,
  TableCell as DocxCell, HeadingLevel, AlignmentType, WidthType,
  PageBreak, Header as DocxHeader, Footer as DocxFooter,
  ShadingType, ExternalHyperlink, LevelFormat, ImageRun,
  ISectionOptions,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { Document, Inline, Block } from "../model/types.js";

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

export async function exportDocx(doc: Document, outputPath: string, baseDir: string = "."): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  for (const block of doc.content) {
    const elements = blockToDocx(block, baseDir);
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

  if (doc.header) {
    const parts = splitHeaderFooter(doc.header);
    const headerChildren: Paragraph[] = [];
    if (parts[0]) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: parts[0], size: 18, font: "Inter" })],
      }));
    }
    if (parts[1]) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: parts[1], size: 18, font: "Inter" })],
      }));
    }
    if (parts[2]) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: parts[2], size: 18, font: "Inter" })],
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
        children: [new TextRun({ text: parts[0], size: 18, font: "Inter" })],
      }));
    }
    if (parts.length > 1 && parts[1]) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: parts[1], size: 18, font: "Inter" })],
      }));
    }
    (section as unknown as Record<string, unknown>).footers = {
      default: new DocxFooter({ children: footerChildren }),
    };
  }

  const sections: ISectionOptions[] = [section];

  const numbering = doc.content.some(b => b.type === "ordered-list") ? {
    config: [{
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
    }]
  } : undefined;

  const docxDoc = new DocxDocument({
    sections,
    numbering,
  });
  const buffer = await Packer.toBuffer(docxDoc);
  fs.writeFileSync(outputPath, buffer);
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
  if (isLandscape) return { width: s.height, height: s.width };
  return s;
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

function renderInlineText(inlines: Inline[]): string {
  return inlines.map(inl => {
    switch (inl.type) {
      case "text": return inl.text;
      case "bold": return renderInlineText(inl.text);
      case "italic": return renderInlineText(inl.text);
      case "strikethrough": return renderInlineText(inl.text);
      case "code": return inl.text;
      case "link": return inl.text;
      case "colored": return renderInlineText(inl.text);
    }
  }).join("");
}

export function inlineToRuns(inlines: Inline[], size?: number, font?: string): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  for (const inline of inlines) {
    switch (inline.type) {
      case "text":
        runs.push(new TextRun({ text: inline.text, size, font }));
        break;
      case "bold":
        runs.push(new TextRun({ text: renderInlineText(inline.text), bold: true, size, font }));
        break;
      case "italic":
        runs.push(new TextRun({ text: renderInlineText(inline.text), italics: true, size, font }));
        break;
      case "strikethrough":
        runs.push(new TextRun({ text: renderInlineText(inline.text), strike: true, size, font }));
        break;
      case "code":
        runs.push(new TextRun({ text: inline.text, font: "Consolas", size: size || 20, color: "E83E8C" }));
        break;
      case "link":
        runs.push(new ExternalHyperlink({
          children: [new TextRun({ text: inline.text, style: "Hyperlink", size, font })],
          link: inline.url,
        }));
        break;
      case "colored": {
        const hexColor = normalizeColor(inline.color);
        runs.push(new TextRun({ text: renderInlineText(inline.text), color: hexColor, size, font }));
        break;
      }
    }
  }
  return runs;
}

function parseImageWidth(width: string, containerPixels: number = 600): number {
  const trimmed = width.trim();
  if (trimmed.endsWith("%")) {
    const pct = parseFloat(trimmed);
    return Math.round(containerPixels * pct / 100);
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

function blockToDocx(block: Block, baseDir: string): (Paragraph | Table)[] {
  switch (block.type) {
    case "heading": {
      const sizeMap: Record<number, number> = { 1: 48, 2: 40, 3: 32, 4: 28, 5: 24, 6: 22 };
      const size = sizeMap[block.level] || 22;
      return [new Paragraph({
        heading: HEADING_MAP[block.level],
        spacing: { before: 240, after: 120 },
        children: inlineToRuns(block.text, size),
      })];
    }

    case "paragraph": {
      return [new Paragraph({
        spacing: { after: 120 },
        children: inlineToRuns(block.text),
      })];
    }

    case "unordered-list": {
      return block.items.map(item =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: inlineToRuns(item.text),
        })
      );
    }

    case "ordered-list": {
      return block.items.map(item =>
        new Paragraph({
          numbering: { reference: "ordered-list", level: 0 },
          spacing: { after: 60 },
          children: inlineToRuns(item.text),
        })
      );
    }

    case "checklist": {
      return block.items.map(item => {
        const prefix = item.checked ? "☑ " : "☐ ";
        return new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: prefix }), ...inlineToRuns(item.text)],
        });
      });
    }

    case "table": {
      const colCount = block.rows.length > 0 ? block.rows[0].length : 1;
      const colWidth = Math.floor(9000 / colCount);
      const columnWidths = Array(colCount).fill(colWidth);

      const rows: TableRow[] = block.rows.map((row, rowIdx) => {
        const cells = row.map((cell, colIdx) => {
          const paragraphs = cell.text.length > 0
            ? [new Paragraph({ children: inlineToRuns(cell.text) })]
            : [new Paragraph({ children: [] })];
          return new DocxCell({
            children: paragraphs,
            width: { size: columnWidths[colIdx], type: WidthType.DXA },
            shading: block.header && rowIdx === 0
              ? { type: ShadingType.CLEAR as any, fill: "F2F2F2" }
              : undefined,
          });
        });
        return new TableRow({ children: cells });
      });

      const table = new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths,
      });
      return [table];
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
      const imageType = ext === ".png" ? "png" : ext === ".jpg" || ext === ".jpeg" ? "jpeg" : null;

      if (imageType) {
        let imgWidth = 400;
        let imgHeight = 300;
        if (block.width) {
          imgWidth = parseImageWidth(block.width);
          imgHeight = Math.round(imgWidth * 0.75);
        }
        const alignment = block.position === "center" ? AlignmentType.CENTER
          : block.position === "right" ? AlignmentType.RIGHT
          : AlignmentType.LEFT;
        const imageRun = new ImageRun({
          data: imageBuffer,
          transformation: { width: imgWidth, height: imgHeight },
        });
        return [new Paragraph({ children: [imageRun], alignment })];
      }

      return [new Paragraph({
        children: [new TextRun({ text: `[Image: ${block.src}]`, italics: true })],
      })];
    }

    case "code": {
      const lines = block.content.split("\n");
      return lines.map(line =>
        new Paragraph({
          spacing: { after: 0, line: 276 },
          indent: { left: 720 },
          shading: { type: ShadingType.CLEAR as any, fill: "F5F5F5" },
          children: [new TextRun({ text: line, font: "Consolas", size: 18 })],
        })
      );
    }

    case "raw": {
      return block.content.split("\n").map(line =>
        new Paragraph({ children: [new TextRun({ text: line })] })
      );
    }

    case "page-break": {
      return [new Paragraph({ children: [new PageBreak()] })];
    }

    default:
      return [];
  }
}
