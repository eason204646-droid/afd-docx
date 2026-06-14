import * as fs from "fs";
import { parse } from "../parser/index.js";

export function validateCommand(args: string[]): void {
  const filePath = args[0];
  if (!filePath) {
    console.error("Usage: afd validate <file.afd>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`);
    process.exit(1);
  }

  const source = fs.readFileSync(filePath, "utf-8");
  const result = parse(source);

  if (result.errors.length === 0) {
    const contentCount = result.document.content.length;
    console.log(`✅ ${filePath} is valid AFD`);
    console.log(`   Blocks: ${contentCount}`);
    if (result.document.meta.title) console.log(`   Title: ${result.document.meta.title}`);
    if (result.document.meta.author) console.log(`   Author: ${result.document.meta.author}`);
    process.exit(0);
  } else {
    console.error(`❌ ${filePath} has ${result.errors.length} error(s):`);
    for (const err of result.errors) {
      console.error(`   Line ${err.lineNumber}: ${err.message}`);
    }
    process.exit(1);
  }
}
