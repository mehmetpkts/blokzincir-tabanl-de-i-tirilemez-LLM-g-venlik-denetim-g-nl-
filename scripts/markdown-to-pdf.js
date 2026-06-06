const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(value) {
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let inList = false;
  let inOrderedList = false;
  let inBlockquote = false;
  let paragraph = [];

  function closeParagraph() {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function closeList() {
    if (inList) {
      out.push(inOrderedList ? "</ol>" : "</ul>");
      inList = false;
      inOrderedList = false;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      out.push("</blockquote>");
      inBlockquote = false;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeLines = [];
      } else {
        closeParagraph();
        closeList();
        closeBlockquote();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      i += 1;
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      closeList();
      closeBlockquote();
      i += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      closeParagraph();
      closeList();
      closeBlockquote();
      out.push("<hr />");
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      closeBlockquote();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    const image = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line);
    if (image) {
      closeParagraph();
      closeList();
      closeBlockquote();
      out.push(`<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" /><figcaption>${renderInline(image[1])}</figcaption></figure>`);
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeParagraph();
      closeList();
      closeBlockquote();
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }

      out.push("<table>");
      out.push(`<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join("")}</tr></thead>`);
      out.push("<tbody>");
      for (const row of rows) {
        out.push(`<tr>${row.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`);
      }
      out.push("</tbody></table>");
      continue;
    }

    const unordered = /^\s*-\s+(.+)$/.exec(line);
    if (unordered) {
      closeParagraph();
      closeBlockquote();
      if (!inList || inOrderedList) {
        closeList();
        out.push("<ul>");
        inList = true;
        inOrderedList = false;
      }
      out.push(`<li>${renderInline(unordered[1])}</li>`);
      i += 1;
      continue;
    }

    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      closeParagraph();
      closeBlockquote();
      if (!inList || !inOrderedList) {
        closeList();
        out.push("<ol>");
        inList = true;
        inOrderedList = true;
      }
      out.push(`<li>${renderInline(ordered[1])}</li>`);
      i += 1;
      continue;
    }

    const quote = /^\s*>\s?(.+)$/.exec(line);
    if (quote) {
      closeParagraph();
      closeList();
      if (!inBlockquote) {
        out.push("<blockquote>");
        inBlockquote = true;
      }
      out.push(`<p>${renderInline(quote[1])}</p>`);
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  closeParagraph();
  closeList();
  closeBlockquote();
  return out.join("\n");
}

function buildHtml(markdown, title) {
  const parts = markdown.split(/^\s*<!--\s*pagebreak\s*-->\s*$/m);
  const body = parts.length > 1
    ? `<section class="cover-page">${renderMarkdown(parts[0])}</section>
<div class="page-break"></div>
<main>${renderMarkdown(parts.slice(1).join("\n"))}</main>`
    : `<main>${renderMarkdown(markdown)}</main>`;
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm;

      @bottom-center {
        color: #64748b;
        content: "Sayfa " counter(page);
        font-family: "Segoe UI", "DejaVu Sans", Arial, sans-serif;
        font-size: 9pt;
      }
    }

    body {
      color: #172033;
      font-family: "Segoe UI", "DejaVu Sans", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      margin: 0;
      background: #ffffff;
    }

    .cover-page {
      align-items: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 248mm;
      text-align: center;
    }

    .cover-page h1 {
      border-bottom: 0;
      font-size: 24pt;
      letter-spacing: 0.2px;
      margin: 0 0 8mm;
      padding: 0;
      text-transform: uppercase;
    }

    .cover-page h2 {
      border-bottom: 0;
      font-size: 17pt;
      margin: 0 0 3mm;
      padding: 0;
    }

    .cover-page h3 {
      color: #0f766e;
      font-size: 15pt;
      margin: 9mm 0 8mm;
    }

    .cover-page p {
      font-size: 11.5pt;
      margin: 1.8mm 0;
      max-width: 150mm;
    }

    .cover-page ul {
      list-style: none;
      margin: 1mm 0 4mm;
      padding: 0;
    }

    .cover-page li {
      font-size: 11.5pt;
      margin: 1.2mm 0;
    }

    .page-break {
      break-after: page;
      page-break-after: always;
    }

    h1, h2, h3, h4 {
      color: #102033;
      line-height: 1.2;
      page-break-after: avoid;
    }

    h1 {
      border-bottom: 3px solid #0f766e;
      font-size: 24pt;
      margin: 0 0 10mm;
      padding-bottom: 5mm;
    }

    h2 {
      border-bottom: 1px solid #d8e0eb;
      font-size: 16pt;
      margin: 11mm 0 4mm;
      padding-bottom: 2mm;
    }

    h3 {
      font-size: 13pt;
      margin: 7mm 0 2mm;
    }

    p {
      margin: 0 0 3.5mm;
      text-align: justify;
    }

    ul, ol {
      margin: 0 0 4mm 6mm;
      padding-left: 5mm;
    }

    li {
      margin: 1.2mm 0;
      text-align: left;
    }

    code {
      background: #eef4f7;
      border-radius: 3px;
      color: #0f4c5c;
      font-family: Consolas, "Courier New", monospace;
      font-size: 9.2pt;
      padding: 1px 4px;
    }

    pre {
      background: #0f172a;
      border-radius: 7px;
      color: #e5edf6;
      font-family: Consolas, "Courier New", monospace;
      font-size: 8.4pt;
      line-height: 1.45;
      margin: 4mm 0;
      overflow-wrap: anywhere;
      padding: 4mm;
      page-break-inside: avoid;
      white-space: pre-wrap;
    }

    pre code {
      background: transparent;
      color: inherit;
      font-size: inherit;
      padding: 0;
    }

    table {
      border-collapse: collapse;
      margin: 4mm 0;
      page-break-inside: avoid;
      width: 100%;
    }

    th, td {
      border: 1px solid #d8e0eb;
      padding: 2mm;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #eef4f7;
      color: #102033;
      font-weight: 700;
    }

    blockquote {
      border-left: 4px solid #0f766e;
      color: #334155;
      margin: 4mm 0;
      padding: 1mm 0 1mm 4mm;
    }

    blockquote p,
    th,
    td,
    figcaption,
    .cover-page p {
      text-align: left;
    }

    a {
      color: #0f766e;
      text-decoration: none;
      word-break: break-all;
    }

    figure {
      margin: 4mm 0 5mm;
      page-break-inside: avoid;
    }

    img {
      display: block;
      height: auto;
      margin: 0 auto 2mm;
      max-width: 100%;
    }

    figcaption {
      color: #334155;
      font-size: 9.5pt;
      line-height: 1.35;
      margin: 0 auto;
      max-width: 95%;
      text-align: center;
    }

    hr {
      border: 0;
      border-top: 1px solid #d8e0eb;
      margin: 6mm 0;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function fileUrl(filePath) {
  return `file:///${path.resolve(filePath).replace(/\\/g, "/").replace(/ /g, "%20")}`;
}

function main() {
  const input = process.argv[2] || "docs/detayli-teknik-rapor.md";
  const output = process.argv[3] || input.replace(/\.md$/i, ".pdf");
  const htmlOutput = output.replace(/\.pdf$/i, ".html");
  const browser = findBrowser();

  if (!browser) {
    throw new Error("Chrome or Edge executable was not found.");
  }

  const markdown = fs.readFileSync(input, "utf8");
  const title = path.basename(input, path.extname(input));
  const html = buildHtml(markdown, title);
  fs.writeFileSync(htmlOutput, html, "utf8");

  const browserAttempts = [
    ["--headless=new"],
    ["--headless"],
    ["--headless=old"]
  ];
  let lastResult = null;

  for (const headlessArgs of browserAttempts) {
    const result = spawnSync(browser, [
      ...headlessArgs,
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--print-to-pdf-no-header",
      `--user-data-dir=${path.resolve("cache/pdf-browser-profile")}`,
      `--print-to-pdf=${path.resolve(output)}`,
      fileUrl(htmlOutput)
    ], {
      encoding: "utf8"
    });

    lastResult = result;
    if (result.status === 0 && fs.existsSync(output)) {
      break;
    }
  }

  if (!fs.existsSync(output)) {
    const details = [
      lastResult && `status=${lastResult.status}`,
      lastResult && lastResult.error && `error=${lastResult.error.message}`,
      lastResult && lastResult.stderr && `stderr=${lastResult.stderr}`,
      lastResult && lastResult.stdout && `stdout=${lastResult.stdout}`
    ].filter(Boolean).join("\n");
    throw new Error(details || "Browser PDF generation failed.");
  }

  console.log(`HTML written: ${htmlOutput}`);
  console.log(`PDF written: ${output}`);
}

main();
