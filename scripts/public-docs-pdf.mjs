/**
 * File: public-docs-pdf.mjs
 * Description: Renders generated public Markdown documents into lightweight static PDFs without external dependencies.
 */
import { writeFile } from 'node:fs/promises';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 58;
const MARGIN_BOTTOM = 58;
const BODY_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const COLORS = {
  ink: [0.09, 0.16, 0.24],
  muted: [0.33, 0.43, 0.53],
  accent: [0.04, 0.38, 0.62],
  rule: [0.72, 0.82, 0.9],
};

function normalizePdfText(value) {
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInlineMarkdown(value) {
  return normalizePdfText(value)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

function escapePdfString(value) {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function escapePdfName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getApproxTextWidth(text, fontSize, fontName) {
  const weight = fontName === 'Helvetica-Bold' ? 0.56 : 0.52;
  return normalizePdfText(text).length * fontSize * weight;
}

function wrapText(text, fontSize, maxWidth, fontName = 'Helvetica') {
  const cleanText = normalizePdfText(text);
  if (!cleanText) {
    return [];
  }

  const words = cleanText.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (getApproxTextWidth(nextLine, fontSize, fontName) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (getApproxTextWidth(word, fontSize, fontName) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let fragment = '';
    for (const character of word) {
      const nextFragment = `${fragment}${character}`;
      if (getApproxTextWidth(nextFragment, fontSize, fontName) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment = nextFragment;
      }
    }
    currentLine = fragment;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

class PdfDocumentBuilder {
  constructor({ title, subtitle, version }) {
    this.title = normalizePdfText(title);
    this.subtitle = normalizePdfText(subtitle ?? '');
    this.version = normalizePdfText(version ?? '');
    this.pages = [];
    this.commands = [];
    this.y = PAGE_HEIGHT - MARGIN_TOP;
    this.pageNumber = 0;
    this.startPage();
  }

  startPage() {
    this.pageNumber += 1;
    this.commands = [];
    this.y = PAGE_HEIGHT - MARGIN_TOP;
    this.pages.push(this.commands);
    this.drawFooter();
  }

  drawFooter() {
    const label = `Open World Assembly - ${this.title} - ${this.pageNumber}`;
    this.addLine(MARGIN_X, MARGIN_BOTTOM - 18, PAGE_WIDTH - MARGIN_X, MARGIN_BOTTOM - 18, COLORS.rule, 0.6);
    this.addText(label, MARGIN_X, MARGIN_BOTTOM - 36, 8.5, 'Helvetica', COLORS.muted);
  }

  ensureSpace(requiredHeight) {
    if (this.y - requiredHeight < MARGIN_BOTTOM) {
      this.startPage();
    }
  }

  addText(text, x, y, fontSize, fontName = 'Helvetica', color = COLORS.ink) {
    if (!normalizePdfText(text)) {
      return;
    }

    this.commands.push(
      `BT ${color.map((part) => part.toFixed(3)).join(' ')} rg /${fontName === 'Helvetica-Bold' ? 'F2' : 'F1'} ${fontSize} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfString(text)}) Tj ET`,
    );
  }

  addLine(x1, y1, x2, y2, color = COLORS.rule, width = 0.7) {
    this.commands.push(
      `${color.map((part) => part.toFixed(3)).join(' ')} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  addWrappedText(text, { x = MARGIN_X, fontSize = 11, fontName = 'Helvetica', lineHeight = 16, maxWidth = BODY_WIDTH, color = COLORS.ink, bullet = false }) {
    const prefix = bullet ? '- ' : '';
    const firstLineIndent = bullet ? 12 : 0;
    const hangingIndent = bullet ? 16 : 0;
    const lines = wrapText(text, fontSize, maxWidth - firstLineIndent, fontName);

    if (!lines.length) {
      return;
    }

    this.ensureSpace(lines.length * lineHeight + 4);

    for (const [index, line] of lines.entries()) {
      const linePrefix = index === 0 ? prefix : '';
      const lineX = x + (index === 0 ? firstLineIndent : hangingIndent);
      this.addText(`${linePrefix}${line}`, lineX, this.y, fontSize, fontName, color);
      this.y -= lineHeight;
    }
  }

  addParagraph(text) {
    this.addWrappedText(text, { fontSize: 10.5, lineHeight: 15.25, maxWidth: BODY_WIDTH });
    this.y -= 8;
  }

  addHeading(text, level) {
    const styles = {
      1: { fontSize: 24, lineHeight: 29, before: 0, after: 18 },
      2: { fontSize: 17, lineHeight: 22, before: 18, after: 10 },
      3: { fontSize: 13.5, lineHeight: 18, before: 14, after: 8 },
      4: { fontSize: 11.5, lineHeight: 16, before: 10, after: 6 },
    };
    const style = styles[level] ?? styles[4];

    this.ensureSpace(style.before + style.lineHeight + style.after + 4);
    this.y -= style.before;
    if (level <= 2) {
      this.addLine(MARGIN_X, this.y + 9, PAGE_WIDTH - MARGIN_X, this.y + 9, COLORS.rule, 0.8);
    }
    this.addWrappedText(text, {
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontName: 'Helvetica-Bold',
      color: level <= 2 ? COLORS.accent : COLORS.ink,
    });
    this.y -= style.after;
  }

  addDocumentHeader() {
    this.addWrappedText(this.title, {
      fontSize: 27,
      lineHeight: 32,
      fontName: 'Helvetica-Bold',
      color: COLORS.accent,
    });
    this.y -= 6;

    if (this.subtitle) {
      this.addWrappedText(this.subtitle, {
        fontSize: 12.5,
        lineHeight: 17,
        maxWidth: BODY_WIDTH,
        color: COLORS.ink,
      });
      this.y -= 4;
    }

    if (this.version) {
      this.addWrappedText(this.version, {
        fontSize: 9,
        lineHeight: 13,
        fontName: 'Helvetica-Bold',
        color: COLORS.muted,
      });
    }

    this.y -= 16;
    this.addLine(MARGIN_X, this.y, PAGE_WIDTH - MARGIN_X, this.y, COLORS.rule, 0.9);
    this.y -= 20;
  }

  render() {
    const objects = [];
    const addObject = (content) => {
      objects.push(content);
      return objects.length;
    };

    const catalogId = addObject('');
    const pagesId = addObject('');
    const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIds = [];

    for (const pageCommands of this.pages) {
      const stream = pageCommands.join('\n');
      const streamId = addObject(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`,
      );
      pageIds.push(pageId);
    }

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const chunks = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'];
    const offsets = [0];

    for (const [index, objectContent] of objects.entries()) {
      offsets.push(Buffer.byteLength(chunks.join(''), 'binary'));
      chunks.push(`${index + 1} 0 obj\n${objectContent}\nendobj\n`);
    }

    const xrefOffset = Buffer.byteLength(chunks.join(''), 'binary');
    chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);

    for (let index = 1; index < offsets.length; index += 1) {
      chunks.push(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
    }

    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return Buffer.from(chunks.join(''), 'binary');
  }
}

function getDocumentTitle(markdown, fallbackTitle) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading ? stripInlineMarkdown(heading[1]) : fallbackTitle;
}

function getDocumentSubtitle(markdown, fallbackSubtitle) {
  if (fallbackSubtitle) {
    return fallbackSubtitle;
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));

  if (titleIndex === -1) {
    return '';
  }

  for (const line of lines.slice(titleIndex + 1)) {
    const cleanLine = stripInlineMarkdown(line);
    if (cleanLine) {
      return cleanLine;
    }
  }

  return '';
}

export async function renderMarkdownDocumentToPdf({ markdown, outputPath, title, subtitle, version }) {
  const builder = new PdfDocumentBuilder({
    title: getDocumentTitle(markdown, title),
    subtitle: getDocumentSubtitle(markdown, subtitle),
    version,
  });

  builder.addDocumentHeader();

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const paragraphLines = [];
  let consumedTitle = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }

    builder.addParagraph(stripInlineMarkdown(paragraphLines.join(' ')));
    paragraphLines.length = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line === '---' || line.startsWith('<!--')) {
      flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      if (headingMatch[1].length === 1 && !consumedTitle) {
        consumedTitle = true;
        continue;
      }

      builder.addHeading(stripInlineMarkdown(headingMatch[2]), Math.min(headingMatch[1].length, 4));
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      builder.addWrappedText(stripInlineMarkdown(bulletMatch[1]), {
        fontSize: 10.5,
        lineHeight: 15.25,
        bullet: true,
        maxWidth: BODY_WIDTH,
      });
      builder.y -= 4;
      continue;
    }

    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      builder.addWrappedText(stripInlineMarkdown(quoteMatch[1]), {
        x: MARGIN_X + 14,
        fontSize: 10.25,
        lineHeight: 15,
        maxWidth: BODY_WIDTH - 28,
        color: COLORS.muted,
      });
      builder.y -= 8;
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  await writeFile(outputPath, builder.render());
}

export const PUBLIC_DOCS_PDF_EXTENSION = 'pdf';
