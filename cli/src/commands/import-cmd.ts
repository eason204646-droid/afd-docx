import * as fs from "fs";
import * as path from "path";
import { importDocx } from "../converter/docx-reader.js";
import { formatDocument } from "../formatter/fmt.js";

interface ImportOptions {
  output?: string;
}

export async function importCommand(args: string[], options: ImportOptions): Promise<void> {
  const filePath = args[0];

  if (!filePath) {
    console.error("Usage: afd import <file.docx> [--output <file.afd>]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext !== ".docx") {
    console.error(`Unsupported format: ${ext}. Currently only .docx is supported.`);
    process.exit(1);
  }

  const baseName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  const outputPath = options.output || path.join(dir, `${baseName}.afd`);

  const doc = await importDocx(filePath);
  const afd = formatDocument(doc);
  fs.writeFileSync(outputPath, afd, "utf-8");

  console.log(`Imported ${filePath} → ${outputPath}`);
  console.log(`   Blocks: ${doc.content.length}`);
  if (doc.meta.title) console.log(`   Title: ${doc.meta.title}`);
}
