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
