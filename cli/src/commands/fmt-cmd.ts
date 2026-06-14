import * as fs from "fs";
import { parse } from "../parser/index.js";
import { formatDocument } from "../formatter/fmt.js";

export function fmtCommand(args: string[]): void {
  const filePath = args[0];

  if (!filePath) {
    console.error("Usage: afd fmt <file.afd>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`);
    process.exit(1);
  }

  const source = fs.readFileSync(filePath, "utf-8");
  const result = parse(source);

  if (result.errors.length > 0) {
    console.error(`Warning: ${result.errors.length} parse error(s)`);
    for (const err of result.errors) {
      console.error(`  Line ${err.lineNumber}: ${err.message}`);
    }
  }

  const formatted = formatDocument(result.document);
  fs.writeFileSync(filePath, formatted, "utf-8");
  console.log(`Formatted ${filePath}`);
}
