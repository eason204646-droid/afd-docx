import * as fs from "fs";
import * as path from "path";
import { importDocx } from "../converter/docx-reader.js";
import { formatDocument } from "../formatter/fmt.js";
import { parse } from "../parser/index.js";
import { exportDocx } from "../converter/index.js";

interface EditOptions {
  output?: string;
  keepOldDocx?: boolean;
}

export async function editCommand(args: string[], options: EditOptions): Promise<void> {
  const filePath = args[0];

  if (!filePath) {
    console.error("Usage: afd edit <file.docx|file.afd> [--output <path>] [--keep-old-docx]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ext);

  if (ext === ".docx") {
    // Round 1: DOCX → AFD
    const outputPath = options.output || path.join(dir, `${baseName}.afd`);
    const doc = await importDocx(filePath);
    const afd = formatDocument(doc);
    fs.writeFileSync(outputPath, afd, "utf-8");
    console.log(`Imported ${filePath} → ${outputPath}`);
    console.log(`   Blocks: ${doc.content.length}`);
    if (doc.meta.title) console.log(`   Title: ${doc.meta.title}`);
    if (!options.output) {
      console.log(`\nEdit the AFD file, then run:`);
      console.log(`   afd edit ${outputPath}`);
    }

  } else if (ext === ".afd") {
    // Round 2: AFD → DOCX
    const outputPath = options.output || path.join(dir, `${baseName}.docx`);
    const tmpPath = outputPath + ".tmp";

    // Validate AFD before exporting
    const source = fs.readFileSync(filePath, "utf-8");
    const result = parse(source);
    if (result.errors.length > 0) {
      console.error(`Error: ${result.errors.length} syntax error(s) found:`);
      for (const err of result.errors) {
        console.error(`  Line ${err.lineNumber}: ${err.message}`);
      }
      console.error(`Fix the errors and try again.`);
      process.exit(1);
    }

    // Export to temp file first for safety
    try {
      await exportDocx(result.document, tmpPath, dir);
      if (options.keepOldDocx && fs.existsSync(outputPath)) {
        const bakPath = outputPath.replace(/\.docx$/, ".bak.docx");
        fs.renameSync(outputPath, bakPath);
        console.log(`Backed up old file to ${bakPath}`);
      }
      fs.renameSync(tmpPath, outputPath);
      console.log(`Exported ${filePath} → ${outputPath}`);
      console.log(`   Blocks: ${result.document.content.length}`);
    } catch (e: any) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      const msg = e?.message || String(e);
      console.error(`Export failed: ${msg}`);
      console.error(`The .afd file has been preserved for fixes.`);
      process.exit(1);
    }

  } else {
    console.error(`Unsupported format: ${ext}. Supported: .docx, .afd`);
    process.exit(1);
  }
}
