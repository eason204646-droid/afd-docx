# AFD Document Skill

## Description
Create Word documents by writing plain-text `.afd` files. The `.afd` file is the source of truth — all formatting is inline. Export to DOCX as the final step.

## Core Workflow
1. **Write** an `.afd` file directly (plain text, line-oriented)
2. **Export** to DOCX with `afd export file.afd docx`

Do NOT write DOCX files directly. Always edit the `.afd`, then export.

## Format Reference

### Front Matter (YAML)
```yaml
---
title: "Document Title"
author: "AI"
page:
  size: A4
  margin: 2.54cm
styles:
  h1:
    size: 24
    bold: true
    font: "Inter"
    color: "#1a1a1a"
  normal:
    size: 11
    line-height: 1.5
---
```

### Content Blocks
| Marker | Description |
|--------|-------------|
| `h1:` — `h6:` | Headings |
| `p:` | Paragraphs |
| `ul:` ... `end` | Bullet list |
| `ol:` ... `end` | Numbered list |
| `cl:` ... `end` | Checklist (`[x]` / `[ ]`) |
| `tbl:` ... `end` | Table (`\| cell \| cell \|`) |
| `img:` + `cap:` / `w:` / `pos:` | Image (`w:` supports %, px, cm; `pos:` left/center/right) |
| `code:lang` ... `end` | Code block |
| `hdr:` / `ftr:` | Header / Footer (`@PAGE` = page number) |
| `br` | Page break |

### Inline Formatting
- `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`, `[link](url)`
- `{color:red}text{/color}` — colored text

## DOCX Layout Guidelines

Follow these conventions to produce professional-looking Word documents:

### Page Setup
- **Size:** Use `A4` for international docs, `Letter` for US. Don't use `Legal` or `Tabloid` unless required.
- **Margin:** `2.54cm` (1 inch) for formal docs, `2cm` for space-efficient ones. Don't go below `1.5cm`.
- **Orientation:** Omit for portrait. Only set `orientation: landscape` for wide tables or diagrams.

### Typography
- **Font pairing:** Pick a sans-serif for body (`Inter`, `Noto Sans`, `Calibri`) and optionally a serif for headings (`Georgia`, `Noto Serif`). Don't mix more than 2 fonts.
- **Sizes:** Body `11pt`, h1 `24pt`, h2 `18pt`, h3 `14pt`. Line-height `1.5` for readability.
- **Color:** Body `#333333` (soft black) is better than `#000000`. Headings `#1A1A1A`. Avoid light gray text.
- **Code blocks:** Use `Consolas` or `JetBrains Mono` at `10pt`, background tint `#F5F5F5`.

### Styles (via front matter)
```yaml
styles:
  h1:
    size: 24
    bold: true
    font: "Inter"
    color: "#1A1A1A"
  h2:
    size: 18
    bold: true
    font: "Inter"
    color: "#333333"
  normal:
    size: 11
    line-height: 1.5
    font: "Inter"
    color: "#333333"
```

### Tables
- Always use `tbl: bordered header` for professional appearance.
- Keep columns to 3–5; wrap long text instead of making very wide columns.
- First row becomes gray-backed header row automatically.

### Images
- Set `w:` to a percentage (`80%`) rather than fixed pixels — it adapts to page width.
- Use `pos: center` for standalone images, `pos: left` for inline.
- Place images after the paragraph that introduces them.

### Headers & Footers
- Use `hdr:` and `ftr:` sparingly — only when the document is 3+ pages.
- `ftr: @PAGE` inserts automatic page numbering.
- Pipe syntax splits left/center/right: `hdr: left | center | right`

### Structure Rules
1. Always start with `; AFD v1` comment.
2. Front matter is required when using `styles:` or custom `page:` — omit if truly minimal.
3. Never nest lists (flat only).
4. Use blank lines between blocks for readability (they don't affect output).
5. Place `br` (page break) on its own line between sections, not inside a paragraph.

## CLI Commands
```
afd export <file.afd> docx              Export to Word (main command)
afd export <file.afd> docx --keep-afd   Export, keep .afd
afd export <file.afd> md                Export to Markdown
afd validate <file.afd>                 Validate syntax
afd fmt <file.afd>                      Format/normalize
afd import <file.docx>                  Import Word to AFD
afd edit <file.docx|file.afd>           Round-trip edit
```
