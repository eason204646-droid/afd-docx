#!/usr/bin/env node

import { CliError } from "./cli-error.js";
import { createCommand } from "./commands/create.js";
import { validateCommand } from "./commands/validate.js";
import { exportCommand } from "./commands/export-cmd.js";
import { importCommand } from "./commands/import-cmd.js";
import { fmtCommand } from "./commands/fmt-cmd.js";
import { editCommand } from "./commands/edit-cmd.js";

const VERSION = "0.1.1";

function showHelp(): void {
  console.log(`AFD v${VERSION} — Agent First Document Toolchain

USAGE
  afd <command> [options] [args]

COMMANDS
  export <file.afd> [format] Export AFD to another format (validates first, deletes .afd after)
    --output <path>            Output file path
    --keep-afd                 Keep the .afd file after export
    --keep-old-docx            Back up existing .docx before overwriting
    Formats: docx (default), md, html, txt

  validate <file.afd>        Validate AFD syntax

  create <file.afd>          Create from template (human use only)
    --template <name>          doc, report, presentation, spreadsheet
    --title <text>             Document title
    --author <text>            Author name
    --force                    Overwrite existing file

  import <file.docx>         Import DOCX to AFD
    --output <path>            Output AFD file path

  edit <file.docx|file.afd>  Round-trip edit: DOCX ↔ AFD (validates before export)
    --output <path>            Output file path
    --keep-old-docx            Back up existing .docx before overwriting

  fmt <file.afd>             Format/normalize AFD file

  help                       Show this help

WORKFLOW
  Write .afd file → afd export file.afd docx → Word document

EXAMPLES
  afd export doc.afd docx
  afd export doc.afd docx --keep-afd
  afd export doc.afd docx --keep-old-docx
  afd export doc.afd md --output README.md
  afd edit doc.afd --keep-old-docx
  afd validate doc.afd
  afd fmt doc.afd
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    showHelp();
    return;
  }

  if (cmd === "--version" || cmd === "-v") {
    console.log(`afd v${VERSION}`);
    return;
  }

  switch (cmd) {
    case "create": {
      const templateIndex = args.indexOf("--template");
      const template = templateIndex !== -1 ? args[templateIndex + 1] : undefined;
      const titleIndex = args.indexOf("--title");
      const title = titleIndex !== -1 ? args[titleIndex + 1] : undefined;
      const authorIndex = args.indexOf("--author");
      const author = authorIndex !== -1 ? args[authorIndex + 1] : undefined;
      const contentIndex = args.indexOf("--content");
      const content = contentIndex !== -1 ? args[contentIndex + 1] : undefined;
      const force = args.includes("--force");
      const noExport = args.includes("--no-export");
      await createCommand(args.slice(1), { template, title, author, content, force, noExport });
      break;
    }

    case "validate":
      validateCommand(args.slice(1));
      break;

    case "export": {
      const outputIndex = args.indexOf("--output");
      const output = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
      const keepAfd = args.includes("--keep-afd");
      const keepOldDocx = args.includes("--keep-old-docx");
      await exportCommand(args.slice(1), { output, keepAfd, keepOldDocx });
      break;
    }

    case "import": {
      const outputIndex = args.indexOf("--output");
      const output = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
      await importCommand(args.slice(1), { output });
      break;
    }

    case "edit": {
      const outputIndex = args.indexOf("--output");
      const output = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
      const keepOldDocx = args.includes("--keep-old-docx");
      await editCommand(args.slice(1), { output, keepOldDocx });
      break;
    }

    case "fmt":
      fmtCommand(args.slice(1));
      break;

    case "help":
      showHelp();
      break;

    default:
      throw new CliError(`Unknown command: ${cmd}. Run 'afd --help' for usage.`);
  }
}

main().catch(err => {
  if (err instanceof CliError) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error(`Fatal error: ${err.message}`);
  }
  process.exit(1);
});
