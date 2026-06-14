import * as fs from "fs";
import { CliError } from "../cli-error.js";
import { parse } from "../parser/index.js";
import { formatDocument } from "../formatter/fmt.js";

export function fmtCommand(args: string[]): void {
  const filePath = args[0];

  if (!filePath) {
    throw new CliError("Usage: afd fmt <file.afd>");
  }

  if (!fs.existsSync(filePath)) {
    throw new CliError(`${filePath} not found`);
  }

  const source = fs.readFileSync(filePath, "utf-8");
  const result = parse(source);

  if (result.errors.length > 0) {
    let msg = `Warning: ${result.errors.length} parse error(s)\n`;
    for (const err of result.errors) {
      msg += `  Line ${err.lineNumber}: ${err.message}\n`;
    }
    console.warn(msg.trimEnd());
  }

  const formatted = formatDocument(result.document);
  fs.writeFileSync(filePath, formatted, "utf-8");
  console.log(`Formatted ${filePath}`);
}
