# AFD — Agent First Document

> **A plain-text document format. Write `.afd`, export to DOCX.**

AFD lets you create Word documents by writing plain text. All formatting (bold, headings, tables, colors, font size, line spacing) is inline — no Word, no APIs, no library code.

## Installation

```bash
# via npm (recommended)
npm install -g afd-cli

# or build from source
git clone https://github.com/eason204646-droid/afd-docx.git
cd afd-docx/cli
npm install
npm run build
npm link
```

After installation, `afd` is available as a global command.

## How to Use

### 1. Write an `.afd` file

Create a plain text file with any text editor or AI agent:

```afd
; AFD v1
---
title: "My Document"
author: "AI"
styles:
  h1:
    size: 24
    bold: true
  normal:
    size: 11
    line-height: 1.5
---

h1: Hello World
p: This is **bold** and *italic* text.
```

### 2. Export to Word

```bash
afd export mydoc.afd docx
```

The tool validates syntax first. On success, it generates `mydoc.docx` and deletes the `.afd`. On error, it reports the issue and preserves the `.afd` for fixes.

## Complete Format Reference

### Front Matter (YAML metadata)

```yaml
---
title: "Document Title"
author: "Author Name"
date: "2025-06-13"
page:
  size: A4              # A4, Letter, A3, Legal
  margin: 2.54cm
  orientation: portrait # portrait or landscape
styles:
  h1:
    size: 24
    bold: true
    font: "Inter"
    color: "#1A1A1A"
  h2:
    size: 18
    bold: true
  normal:
    size: 11
    line-height: 1.5
    font: "Inter"
---
```

### Content Blocks

| Marker | Description |
|--------|-------------|
| `h1:` to `h6:` | Headings |
| `p:` | Paragraph |
| `ul:` ... `end` | Bullet list (items prefixed with `-`) |
| `ol:` ... `end` | Numbered list (items prefixed with `1.`) |
| `cl:` ... `end` | Checklist (`[x]` done, `[ ]` pending) |
| `tbl:` ... `end` | Table (`\| cell \| cell \|`) |
| `img:` | Image (`cap:`, `w:`, `pos:` follow) |
| `code:lang` ... `end` | Code block |
| `hdr:` | Header (use `\|` to separate left/center/right) |
| `ftr:` | Footer (`@PAGE` inserts page number) |
| `br` | Page break |
| `raw:` ... `end` | Raw content (pass-through) |

### Inline Formatting

| Syntax | Result |
|--------|--------|
| `**text**` | **Bold** |
| `*text*` | *Italic* |
| `` `code` `` | `Code` |
| `~~text~~` | ~~Strikethrough~~ |
| `[text](url)` | Hyperlink |
| `{color:#FF0000}text{/color}` | Colored text (use hex like `#FF0000`; named colors like `red` also work) |

## All Commands

| Command | Description |
|---------|-------------|
| `afd export <file.afd> docx` | **Export to Word** (validates first, deletes .afd on success) |
| `afd export <file.afd> md` | Export to Markdown |
| `afd export <file.afd> txt` | Export to plain text |
| `afd validate <file.afd>` | Check syntax errors |
| `afd fmt <file.afd>` | Format/normalize AFD file |
| `afd import <file.docx>` | Convert Word document to AFD |
| `afd create <file.afd>` | Create from template (human users) |

### Safety Options

| Flag | Applies to | Effect |
|------|-----------|--------|
| `--keep-afd` | `export` | Keep the `.afd` file after export |
| `--keep-old-docx` | `export`, `edit` | Back up existing `.docx` as `.bak.docx` before overwriting |
| `--output <path>` | `export`, `import`, `edit` | Specify output file path |

## Example

Create a report with all features:

```afd
; AFD v1
---
title: "Q1 Report"
author: "AI"
page:
  size: A4
  margin: 2.5cm
styles:
  h1: { size: 28, bold: true, color: "#1A1A1A" }
  h2: { size: 18, bold: true }
  normal: { size: 11, line-height: 1.5 }
---

h1: Executive Summary
p: Revenue grew **15%** year-over-year.
p: {color:#FF0000}Warning: targets missed in Q2{/color}

h2: Key Metrics
tbl: bordered header
| Metric | Q1 | Q2 |
| Revenue | $1.2M | $1.4M |
| Users | 12K | 15K |
end

h2: Action Items
cl:
[x] Finalize budget
[ ] Review staffing plan
end
```

## Agent / AI Integration

For AI agents (Claude Code, opencode, etc.), copy `CLAUDE.md` from this repo to your project root. The agent will then know:

1. **Write `.afd` files directly** using its built-in `write` tool (all formatting inline)
2. **Edit** with its `edit` tool (line-based, precise)
3. **Export** with `afd export file.afd docx`

The `.afd` file is the source of truth. Never produce DOCX files directly — always write `.afd` and export.

### Install the AFD Skill

To make your agent aware of the AFD format as a reusable skill, copy the skill file to your agent's skills directory:

```bash
# Claude Code
mkdir -p ~/.claude/skills/afd-docx
cp skill/SKILL.md ~/.claude/skills/afd-docx/SKILL.md

# opencode
mkdir -p ~/.config/opencode/skills/afd-docx
cp skill/SKILL.md ~/.config/opencode/skills/afd-docx/SKILL.md
```

After installation, the agent can load the skill using `afd-docx` when creating documents.

## Performance vs Traditional Approaches

Compared to using Python (`python-docx`) or JS (`docx`) libraries directly:

| Task | Traditional (Python/JS) | AFD | Speedup |
|------|------------------------|-----|---------|
| Create a document | Write code, run script | Write .afd, `afd export` | ~2x faster |
| Edit formatting | Modify code, rerun | Edit inline markup, re-export | ~3-5x faster |
| Token cost (AI) | Code generation + data | Pure text markup | 60-80% fewer tokens |

AFD eliminates the code layer entirely. What you see in `.afd` is what you get in `.docx` — no libraries to import, no objects to construct, no API calls.

## Notes

- Colors use hex format (`#FF0000`). Named colors (`red`, `blue`, etc.) are auto-converted.
- The tool validates AFD syntax before exporting. On error, `.afd` is preserved for fixes.
- Output is written to a temporary file first, then atomically renamed on success.
