import { Document, Inline, Block, ListItem } from "../model/types.js";

export function exportMarkdown(doc: Document): string {
  const lines: string[] = [];

  // Front matter
  if (doc.meta.title || doc.meta.author || doc.meta.date) {
    lines.push("---");
    if (doc.meta.title) lines.push(`title: "${doc.meta.title}"`);
    if (doc.meta.author) lines.push(`author: "${doc.meta.author}"`);
    if (doc.meta.date) lines.push(`date: "${doc.meta.date}"`);
    lines.push("---");
    lines.push("");
  }

  for (const block of doc.content) {
    const mdLines = blockToMarkdown(block, 0);
    if (mdLines.length > 0) {
      lines.push(...mdLines);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function blockToMarkdown(block: Block, indent: number): string[] {
  const prefix = "  ".repeat(indent);

  switch (block.type) {
    case "heading":
      return [`${"#".repeat(block.level)} ${renderInline(block.text)}`];

    case "paragraph":
      return [renderInline(block.text)];

    case "unordered-list":
      return block.items.map(item => `${prefix}- ${renderInline(item.text)}`);

    case "ordered-list":
      return block.items.map((item, i) => `${prefix}${i + 1}. ${renderInline(item.text)}`);

    case "checklist":
      return block.items.map(item =>
        `${prefix}- ${item.checked ? "[x]" : "[ ]"} ${renderInline(item.text)}`
      );

    case "table": {
      if (block.rows.length === 0) return [];
      const result: string[] = [];
      result.push(`| ${block.rows[0].map(c => renderInline(c.text)).join(" | ")} |`);
      result.push(`| ${block.rows[0].map(() => "---").join(" | ")} |`);
      for (let i = 1; i < block.rows.length; i++) {
        result.push(`| ${block.rows[i].map(c => renderInline(c.text)).join(" | ")} |`);
      }
      return result;
    }

    case "image": {
      const alt = block.caption || "image";
      return [`![${alt}](${block.src})`];
    }

    case "code":
      return ["```" + (block.lang || ""), block.content, "```"];

    case "page-break":
      return ["---"];

    default:
      return [];
  }
}

function renderInline(inlines: Inline[]): string {
  return inlines.map(inl => {
    switch (inl.type) {
      case "text": return inl.text;
      case "bold": return `**${renderInline(inl.text)}**`;
      case "italic": return `*${renderInline(inl.text)}*`;
      case "strikethrough": return `~~${renderInline(inl.text)}~~`;
      case "code": return `\`${inl.text}\``;
      case "link": return `[${inl.text}](${inl.url})`;
      case "colored": return renderInline(inl.text);
    }
  }).join("");
}
