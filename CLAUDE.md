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
w: 80%       ; 支持 %, px, cm（如 50%, 400px, 5cm）
pos: center   ; left / center / right

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
| `afd edit file.afd` | 往返编辑（DOCX ↔ AFD，先校验再导出） |

## DOCX 排版建议

遵循以下惯例可以生成专业质量的 Word 文档：

### 页面设置
| 字段 | 推荐值 |
|------|--------|
| `size:` | 国际用 `A4`，美国用 `Letter`，非必需不用 `Legal`/`Tabloid` |
| `margin:` | 正式文档 `2.54cm`，紧凑 `2cm`，不要低于 `1.5cm` |
| `orientation:` | 省略即 portrait，宽表格/大图才用 `landscape` |

### 字体排版
- **字体搭配：** 正文用一套无衬线体（`Inter`、`Noto Sans`、`Calibri`），标题可选衬线体（`Georgia`、`Noto Serif`），最多 2 种字体
- **通用安全选择：** `Arial`/`Calibri` 多数 Windows 系统预装，`Inter`/`Noto Sans` 需手动安装
- **字号：** 正文 `11pt`，h1 `24pt`，h2 `18pt`，h3 `14pt`，行高 `1.5`
- **颜色：** 正文 `#333333` > `#000000`，标题 `#1A1A1A`，避免浅灰正文
- **代码：** `Consolas` 或 `JetBrains Mono` `10pt`，底色 `#F5F5F5`

### 推荐样式
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

### 表格
- 始终用 `tbl: bordered header`，首行自动灰底
- 控制 3–5 列，长文本换行而非拉宽列
- 已自动应用单元格内边距（padding）和 DXA 宽度计算，列宽根据页面尺寸自适应

### 图片
- `w:` 用百分比（如 `80%`）而非固定像素，自动适配页面
- 独立图片用 `pos: center`，随文用 `pos: left`
- 放在引出该图片的段落之后

### 页眉页脚
- 仅 3+ 页的文档使用
- `ftr: @PAGE` 自动插入页码
- 竖线分割左/中/右：`hdr: 左 | 中 | 右`

### 结构要点
1. 文件开头总是 `; AFD v1`
2. 只有用到 `styles:` 或自定义 `page:` 时才需要 front matter，极简文档可以省略
3. 列表是扁平的（不支持嵌套），块之间用空行分隔
4. `br` 分页符独占一行，不要放在段落内

## Dev Scripts

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 TypeScript |
| `npm test` | 运行测试（45 个用例） |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 |

## Agent 工作流

1. **写 `.afd` 文件** — 直接用 `write` 写入完整内容
2. **编辑** — 用 `edit` 按行修改（前缀标记让定位非常精准）
3. **校验** — `afd validate file.afd`
4. **导出** — `afd export file.afd docx`
5. **改代码后** — 先 `npm test && npm run lint`，再提交
