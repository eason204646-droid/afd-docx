import * as fs from "fs";
import * as path from "path";
import { CliError } from "../cli-error.js";
import { parse } from "../parser/index.js";
import { exportDocx, exportMarkdown, exportHtml } from "../converter/index.js";

interface ExportOptions {
  output?: string;
  keepAfd?: boolean;
  keepOldDocx?: boolean;
}

export async function exportCommand(args: string[], options: ExportOptions): Promise<void> {
  const filePath = args[0];
  const format = args[1] || "docx";

  if (!filePath) {
    throw new CliError("Usage: afd export <file.afd> [docx|md|html|txt] [--output <path>] [--keep-afd] [--keep-old-docx]");
  }

  if (!fs.existsSync(filePath)) {
    throw new CliError(`${filePath} not found`);
  }

  // Step 1: Parse and validate
  const source = fs.readFileSync(filePath, "utf-8");
  const result = parse(source);

  if (result.errors.length > 0) {
    let msg = `${result.errors.length} syntax error(s) found:\n`;
    for (const err of result.errors) {
      msg += `  Line ${err.lineNumber}: ${err.message}\n`;
    }
    msg += "Fix the errors and try again. The .afd file has been preserved.";
    throw new CliError(msg);
  }

  const baseName = path.basename(filePath, path.extname(filePath));
  const dir = path.dirname(filePath);

  // Step 2: Export (with temp file for safety)
  const extMap: Record<string, string> = { docx: ".docx", md: ".md", html: ".html", txt: ".txt" };
  const outputExt = extMap[format] || ".docx";
  const outputPath = options.output || path.join(dir, `${baseName}${outputExt}`);
  const tmpPath = outputPath + ".tmp";

  if (format === "docx") {
    await exportDocx(result.document, tmpPath, dir);
  } else if (format === "md") {
    const md = exportMarkdown(result.document);
    fs.writeFileSync(tmpPath, md, "utf-8");
  } else if (format === "txt") {
    const md = exportMarkdown(result.document);
    const plain = md
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    fs.writeFileSync(tmpPath, plain, "utf-8");
  } else if (format === "html") {
    const html = exportHtml(result.document);
    fs.writeFileSync(tmpPath, html, "utf-8");
  } else {
    throw new CliError(`Unknown format: ${format}. Supported: docx, md, html, txt`);
  }

  // Step 3: Success — atomically replace output file
  if (options.keepOldDocx && fs.existsSync(outputPath)) {
    const bakPath = outputPath.replace(/\.docx$/, ".bak.docx");
    fs.renameSync(outputPath, bakPath);
    console.log(`Backed up old file to ${bakPath}`);
  }
  fs.renameSync(tmpPath, outputPath);
  console.log(`Exported to ${outputPath}`);

  // Step 4: Delete .afd (only reached on success)
  if (!options.keepAfd) {
    fs.unlinkSync(filePath);
    console.log(`Removed ${filePath}`);
  }
}
