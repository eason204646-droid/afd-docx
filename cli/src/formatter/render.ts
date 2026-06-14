import { Inline } from "../model/types.js";

export function renderInline(inlines: Inline[]): string {
  return inlines.map(inl => {
    switch (inl.type) {
      case "text": return inl.text;
      case "bold": return `**${renderInline(inl.text)}**`;
      case "italic": return `*${renderInline(inl.text)}*`;
      case "strikethrough": return `~~${renderInline(inl.text)}~~`;
      case "code": return `\`${inl.text}\``;
      case "link": return `[${inl.text}](${inl.url})`;
      case "colored": return `{color:${inl.color}}${renderInline(inl.text)}{/color}`;
    }
  }).join("");
}
