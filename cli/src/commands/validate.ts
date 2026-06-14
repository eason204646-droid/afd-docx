import * as fs from "fs";
import { CliError } from "../cli-error.js";
import { parse } from "../parser/index.js";

export function validateCommand(args: string[]): void {
  const filePath = args[0];
  if (!filePath) {
    throw new CliError("Usage: afd validate <file.afd>");
  }

  if (!fs.existsSync(filePath)) {
    throw new CliError(`${filePath} not found`);
  }

  const source = fs.readFileSync(filePath, "utf-8");
  const result = parse(source);

  if (result.errors.length === 0) {
    const contentCount = result.document.content.length;
    console.log(`✅ ${filePath} is valid AFD`);
    console.log(`   Blocks: ${contentCount}`);
    if (result.document.meta.title) console.log(`   Title: ${result.document.meta.title}`);
    if (result.document.meta.author) console.log(`   Author: ${result.document.meta.author}`);
  } else {
    let msg = `${filePath} has ${result.errors.length} error(s):\n`;
    for (const err of result.errors) {
      msg += `   Line ${err.lineNumber}: ${err.message}\n`;
    }
    throw new CliError(msg.trimEnd());
  }
}
