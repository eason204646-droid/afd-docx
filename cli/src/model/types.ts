/* ── Inline formatting ── */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: Inline[] }
  | { type: "italic"; text: Inline[] }
  | { type: "strikethrough"; text: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; text: string; url: string }
  | { type: "colored"; color: string; text: Inline[] };

/* ── List items ── */

export interface ListItem {
  checked?: boolean; // for checklists
  text: Inline[];
}

export interface TableCell {
  text: Inline[];
}

/* ── Content blocks ── */

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: Inline[] }
  | { type: "paragraph"; text: Inline[] }
  | { type: "unordered-list"; items: ListItem[] }
  | { type: "ordered-list"; items: ListItem[] }
  | { type: "checklist"; items: ListItem[] }
  | { type: "table"; bordered: boolean; header: boolean; rows: TableCell[][] }
  | { type: "image"; src: string; caption?: string; width?: string; position?: string }
  | { type: "code"; lang?: string; content: string }
  | { type: "raw"; format?: string; content: string }
  | { type: "page-break" };

/* ── Header/footer ── */

export interface HeaderFooterLine {
  left?: string;
  center?: string;
  right?: string;
}

/* ── Style definitions ── */

export interface StyleDef {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  font?: string;
  color?: string;
  "line-height"?: number;
}

/* ── Document ── */

export interface Document {
  version: 1;
  meta: {
    title?: string;
    author?: string;
    date?: string;
    page?: {
      size?: string;
      margin?: string;
      orientation?: string;
    };
    styles?: Record<string, StyleDef>;
    [key: string]: unknown;
  };
  header?: string;
  footer?: string;
  content: Block[];
}
