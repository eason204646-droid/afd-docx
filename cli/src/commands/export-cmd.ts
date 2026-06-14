import * as fs from "fs";
import * as path from "path";
import { parse } from "../parser/index.js";
import { exportDocx, exportMarkdown } from "../converter/index.js";

interface ExportOptions {
  output?: string;
  keepAfd?: boolean;
  keepOldDocx?: boolean;
}

export async function exportCommand(args: string[], options: ExportOptions): Promise<void> {
  const filePath = args[0];
  const format = args[1] || "docx";

  if (!filePath) {
    console.error("Usage: afd export <file.afd> [docx|md|html|txt] [--output <path>] [--keep-afd] [--keep-old-docx]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`);
    process.exit(1);
  }

  // Step 1: Parse and validate
  const source = fs.readFileSync(filePath, "utf-8");
  const result = parse(source);

  if (result.errors.length > 0) {
    console.error(`Error: ${result.errors.length} syntax error(s) found:`);
    for (const err of result.errors) {
      console.error(`  Line ${err.lineNumber}: ${err.message}`);
    }
    console.error(`Fix the errors and try again. The .afd file has been preserved.`);
    process.exit(1);
  }

  const baseName = path.basename(filePath, path.extname(filePath));
  const dir = path.dirname(filePath);

  // Step 2: Export (with temp file for safety)
  const extMap: Record<string, string> = { docx: ".docx", md: ".md", html: ".html", txt: ".txt" };
  const outputExt = extMap[format] || ".docx";
  const outputPath = options.output || path.join(dir, `${baseName}${outputExt}`);
  const tmpPath = outputPath + ".tmp";

  try {
    switch (format) {
      case "docx": {
        await exportDocx(result.document, tmpPath, dir);
        break;
      }

      case "md": {
        const md = exportMarkdown(result.document);
        fs.writeFileSync(tmpPath, md, "utf-8");
        break;
      }

      case "txt": {
        const md = exportMarkdown(result.document);
        const plain = md
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/`([^`]+)`/g, "$1");
        fs.writeFileSync(tmpPath, plain, "utf-8");
        break;
      }

      case "html": {
        const md = exportMarkdown(result.document);
        const html = `<html><body>${md.split("\n\n").map(p => {
          if (p.startsWith("# ")) return `<h1>${p.slice(2)}</h1>`;
          if (p.startsWith("## ")) return `<h2>${p.slice(3)}</h2>`;
          if (p.startsWith("|")) return `<table>${p.split("\n").filter(l => l.startsWith("|")).map(r => {
            const cells = r.split("|").filter(c => c.trim());
            if (r.includes("---")) return "";
            return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join("")}</tr>`;
          }).join("")}</table>`;
          return `<p>${p}</p>`;
        }).join("\n")}</body></html>`;
        fs.writeFileSync(tmpPath, html, "utf-8");
        break;
      }

      default:
        console.error(`Unknown format: ${format}. Supported: docx, md, html, txt`);
        process.exit(1);
    }

    // Step 3: Success — atomically replace output file
    if (options.keepOldDocx && fs.existsSync(outputPath)) {
      const bakPath = outputPath.replace(/\.docx$/, ".bak.docx");
      fs.renameSync(outputPath, bakPath);
      console.log(`Backed up old file to ${bakPath}`);
    }
    fs.renameSync(tmpPath, outputPath);
    console.log(`Exported to ${outputPath}`);

  } catch (e: any) {
    // Cleanup temp file on failure
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    const msg = e?.message || String(e);
    console.error(`Export failed: ${msg}`);
    console.error(`The .afd file has been preserved for fixes.`);
    process.exit(1);
  }

  // Step 4: Delete .afd (only reached on success)
  if (!options.keepAfd) {
    fs.unlinkSync(filePath);
    console.log(`Removed ${filePath}`);
  }
}
