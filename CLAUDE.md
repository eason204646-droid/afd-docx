# AFD — Agent First Document

AFD (`.afd`) is a plain-text document format for AI agents. **The `.afd` file is the source of truth** — it contains all formatting inline, and you export it to DOCX as the final step.

## Core Workflow

```
你写 .afd 文件 → afd export file.afd docx → 得到 Word 文档
```

**永远不要直接操作 DOCX。** 编辑 `.afd` 文件本身（纯文本，行编辑），最后再导出。

## Format Reference

```afd
; AFD v1 — 注释以分号开头
---
title: "文档标题"
author: "AI"
page:
  size: A4              ; A4 / Letter / A3 / Legal
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
    font: "Inter"
---

h1: 一级标题
h2: 二级标题
p: 普通段落，支持**加粗**、*斜体*、`代码`、~~删除线~~、[链接](url)
p: 还支持{color:red}彩色文字{/color}

ul:
- 无序列表项
- 支持**加粗**
end

ol:
1. 有序列表项
2. 第二项
end

cl:
[x] 已完成任务
[ ] 待办任务
end

tbl: bordered header
| 列1 | 列2 | 列3 |
| 单元格 | 单元格 | 单元格 |
end

img: diagram.png
cap: 图片标题
w: 80%
pos: center

code: javascript
console.log("hello");
end

hdr: 页眉左 | 页眉中 | 页眉右
ftr: @PAGE       ; @PAGE 自动插入页码

br              ; 分页符
```

## CLI Commands

| 命令 | 说明 |
|------|------|
| `afd export file.afd docx` | **导出 Word 文档**（先校验语法，成功后再删除 .afd） |
| `afd export file.afd md` | 导出 Markdown（语法错误会报错并保留 .afd） |
| `afd export file.afd docx --keep-afd` | 导出并保留 .afd |
| `afd export file.afd docx --keep-old-docx` | 导出前备份已存在的 .docx 为 .bak.docx |
| `afd validate file.afd` | 校验语法 |
| `afd fmt file.afd` | 格式化 |
| `afd import file.docx` | 从 Word 导入 |
| `afd create file.afd` | 从模板创建（仅人工用，模型用 write 即可） |

## Agent 工作流

1. **写 `.afd` 文件** — 直接用 `write` 写入完整内容
2. **编辑** — 用 `edit` 按行修改（前缀标记让定位非常精准）
3. **校验** — `afd validate file.afd`
4. **导出** — `afd export file.afd docx`
