#!/usr/bin/env node

import { CliError } from "./cli-error.js";
import { createCommand } from "./commands/create.js";
import { validateCommand } from "./commands/validate.js";
import { exportCommand } from "./commands/export-cmd.js";
import { importCommand } from "./commands/import-cmd.js";
import { fmtCommand } from "./commands/fmt-cmd.js";
import { editCommand } from "./commands/edit-cmd.js";

const VERSION = "0.1.1";
const VALUE_FLAGS = new Set(["--output", "--template", "--title", "--author", "--content"]);

function parseArgs(input: string[]): { flags: Record<string, string | boolean>; positional: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let i = 0;
  while (i < input.length) {
    const arg = input[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (VALUE_FLAGS.has(arg) && i + 1 < input.length && !input[i + 1].startsWith("--")) {
        flags[name] = input[i + 1];
        i += 2;
      } else {
        flags[name] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }
  return { flags, positional };
}

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

  const rest = args.slice(1);
  const { flags, positional } = parseArgs(rest);

  switch (cmd) {
    case "create":
      await createCommand(positional, {
        template: flags.template as string | undefined,
        title: flags.title as string | undefined,
        author: flags.author as string | undefined,
        content: flags.content as string | undefined,
        force: !!flags.force,
        noExport: !!flags["no-export"],
      });
      break;

    case "validate":
      validateCommand(positional);
      break;

    case "export":
      await exportCommand(positional, {
        output: flags.output as string | undefined,
        keepAfd: !!flags["keep-afd"],
        keepOldDocx: !!flags["keep-old-docx"],
      });
      break;

    case "import":
      await importCommand(positional, {
        output: flags.output as string | undefined,
      });
      break;

    case "edit":
      await editCommand(positional, {
        output: flags.output as string | undefined,
        keepOldDocx: !!flags["keep-old-docx"],
      });
      break;

    case "fmt":
      fmtCommand(positional);
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
