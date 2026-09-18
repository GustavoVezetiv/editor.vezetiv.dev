import type { JSONContent } from '@tiptap/core'
import type { DocumentPreset } from '../types/activity'

export type ExportFormat = 'docx' | 'pdf'

export interface TextSegment {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize?: number
}

export interface DocumentBlock {
  type: 'heading' | 'paragraph' | 'ordered-list' | 'bullet-list'
  level?: number
  alignment?: 'left' | 'center' | 'right' | 'justify'
  segments?: TextSegment[]
  items?: TextSegment[][]
}

function marksFor(node: JSONContent): TextSegment {
  const marks = node.marks ?? []
  const fontSize = marks.find((mark) => mark.type === 'textStyle')?.attrs?.fontSize
  return {
    text: node.text ?? '',
    bold: marks.some((mark) => mark.type === 'bold'),
    italic: marks.some((mark) => mark.type === 'italic'),
    underline: marks.some((mark) => mark.type === 'underline'),
    fontSize: typeof fontSize === 'string' && Number.isFinite(Number.parseFloat(fontSize)) ? Number.parseFloat(fontSize) : undefined,
  }
}

export function textSegments(nodes: JSONContent[] = []): TextSegment[] {
  return nodes.flatMap((node) => {
    if (node.type === 'text') return [marksFor(node)]
    if (node.type === 'hardBreak') return [{ text: '\n', bold: false, italic: false, underline: false }]
    return textSegments(node.content)
  })
}

export function toDocumentBlocks(content: JSONContent): DocumentBlock[] {
  const blocks: DocumentBlock[] = []
  for (const node of content.content ?? []) {
    if (node.type === 'heading' || node.type === 'paragraph') {
      blocks.push({
        type: node.type,
        level: node.attrs?.level,
        alignment: node.attrs?.textAlign,
        segments: textSegments(node.content),
      })
      continue
    }

    if (node.type === 'orderedList' || node.type === 'bulletList') {
      blocks.push({
        type: node.type === 'orderedList' ? 'ordered-list' : 'bullet-list',
        items: (node.content ?? []).map((item) => textSegments(item.content)),
      })
    }
  }
  return blocks
}

function safeFileName(name: string, format: ExportFormat): string {
  const base = name.trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ') || 'documento'
  return `${base}.${format}`
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function marginsFor(preset: DocumentPreset): { top: number; right: number; bottom: number; left: number } {
  return preset === 'academic-abnt'
    ? { top: 1701, right: 1134, bottom: 1134, left: 1701 }
    : { top: 1440, right: 1440, bottom: 1440, left: 1440 }
}

function defaultAlignment(preset: DocumentPreset): 'left' | 'justify' {
  return preset === 'academic-abnt' ? 'justify' : 'left'
}

export async function exportDocument(content: JSONContent, format: ExportFormat, name: string, preset: DocumentPreset): Promise<void> {
  if (format === 'docx') {
    await exportDocx(content, name, preset)
    return
  }
  await exportPdf(content, name, preset)
}

async function exportDocx(content: JSONContent, name: string, preset: DocumentPreset): Promise<void> {
  const { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun, UnderlineType } = await import('docx')
  const toAlignment = (value?: string) => value === 'center'
    ? AlignmentType.CENTER
    : value === 'right'
      ? AlignmentType.RIGHT
      : value === 'justify'
        ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT
  const runs = (segments: TextSegment[] = []) => segments.map((segment) => new TextRun({
    text: segment.text,
    bold: segment.bold,
    italics: segment.italic,
    underline: segment.underline ? { type: UnderlineType.SINGLE } : undefined,
    size: segment.fontSize ? Math.round(segment.fontSize * 2) : 24,
    font: 'Arial',
  }))
  const paragraphOptions = (alignment?: string) => ({
    alignment: toAlignment(alignment ?? defaultAlignment(preset)),
    spacing: { line: preset === 'academic-abnt' ? 360 : 276, after: 180 },
    indent: preset === 'academic-abnt' ? { firstLine: 709 } : undefined,
  })
  const children = toDocumentBlocks(content).flatMap((block) => {
    if (block.type === 'heading') {
      return [new Paragraph({
        children: runs(block.segments),
        heading: block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        alignment: toAlignment(block.alignment ?? defaultAlignment(preset)),
        spacing: { after: 240 },
      })]
    }
    if (block.type === 'paragraph') return [new Paragraph({ children: runs(block.segments), ...paragraphOptions(block.alignment) })]
    return (block.items ?? []).map((item) => new Paragraph({
      children: runs(item),
      spacing: { line: preset === 'academic-abnt' ? 360 : 276, after: 90 },
      ...(block.type === 'ordered-list' ? { numbering: { reference: 'ordered-list', level: 0 } } : { bullet: { level: 0 } }),
    }))
  })
  const document = new Document({
    numbering: { config: [{ reference: 'ordered-list', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { margin: marginsFor(preset) } }, children: children.length ? children : [new Paragraph('')] }],
  })
  download(await Packer.toBlob(document), safeFileName(name, 'docx'))
}

function splitSegment(segment: TextSegment): TextSegment[] {
  return segment.text.split(/(\s+)/).filter(Boolean).map((text) => ({ ...segment, text }))
}

async function exportPdf(content: JSONContent, name: string, preset: DocumentPreset): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margins = preset === 'academic-abnt' ? { top: 85, right: 57, bottom: 57, left: 85 } : { top: 72, right: 72, bottom: 72, left: 72 }
  const usableWidth = pageWidth - margins.left - margins.right
  let cursorY = margins.top

  const fontStyle = (segment: TextSegment): 'normal' | 'bold' | 'italic' | 'bolditalic' => segment.bold && segment.italic
    ? 'bolditalic'
    : segment.bold
      ? 'bold'
      : segment.italic
        ? 'italic'
        : 'normal'
  const widthOf = (segment: TextSegment, size: number) => {
    pdf.setFont('helvetica', fontStyle(segment))
    pdf.setFontSize(segment.fontSize ?? size)
    return pdf.getTextWidth(segment.text)
  }
  const addPageIfNeeded = (height: number) => {
    if (cursorY + height <= pageHeight - margins.bottom) return
    pdf.addPage()
    cursorY = margins.top
  }
  const drawStyledParagraph = (source: TextSegment[] = [], options: { size: number; alignment?: string; prefix?: string; forceBold?: boolean; indent?: number }) => {
    const initial = options.prefix ? [{ text: options.prefix, bold: false, italic: false, underline: false }, ...source] : source
    const tokens = initial.flatMap(splitSegment).map((segment) => ({ ...segment, bold: options.forceBold || segment.bold }))
    const lines: TextSegment[][] = [[]]
    const widths: number[] = [0]
    for (const token of tokens.length ? tokens : [{ text: ' ', bold: false, italic: false, underline: false }]) {
      if (token.text.includes('\n')) {
        const parts = token.text.split('\n')
        parts.forEach((part, index) => {
          if (part) {
            const partToken = { ...token, text: part }
            lines[lines.length - 1].push(partToken)
            widths[widths.length - 1] += widthOf(partToken, options.size)
          }
          if (index < parts.length - 1) { lines.push([]); widths.push(0) }
        })
        continue
      }
      const width = widthOf(token, options.size)
      if (widths[widths.length - 1] + width > usableWidth - (options.indent ?? 0) && lines[lines.length - 1].length > 0 && !/^\s+$/.test(token.text)) {
        lines.push([])
        widths.push(0)
      }
      lines[lines.length - 1].push(token)
      widths[widths.length - 1] += width
    }

    lines.forEach((line, index) => {
      const lineHeight = Math.max(options.size, ...line.map((segment) => segment.fontSize ?? options.size)) * 1.5
      addPageIfNeeded(lineHeight)
      const lineWidth = widths[index]
      const xStart = options.alignment === 'center'
        ? margins.left + (usableWidth - lineWidth) / 2
        : options.alignment === 'right'
          ? pageWidth - margins.right - lineWidth
          : margins.left + (options.indent ?? 0)
      const extraSpace = options.alignment === 'justify' && index < lines.length - 1
        ? Math.max(0, usableWidth - (options.indent ?? 0) - lineWidth) / Math.max(1, line.filter((segment) => /^\s+$/.test(segment.text)).length)
        : 0
      let x = xStart
      line.forEach((segment) => {
        const size = segment.fontSize ?? options.size
        pdf.setFont('helvetica', fontStyle(segment))
        pdf.setFontSize(size)
        pdf.text(segment.text, x, cursorY)
        const width = pdf.getTextWidth(segment.text)
        if (segment.underline && !/^\s+$/.test(segment.text)) pdf.line(x, cursorY + 1.6, x + width, cursorY + 1.6)
        x += width + (/^\s+$/.test(segment.text) ? extraSpace : 0)
      })
      cursorY += lineHeight
    })
    cursorY += options.size * 0.35
  }

  toDocumentBlocks(content).forEach((block) => {
    if (block.type === 'heading') {
      drawStyledParagraph(block.segments, { size: block.level === 2 ? 18 : 24, alignment: block.alignment ?? defaultAlignment(preset), forceBold: true })
    } else if (block.type === 'paragraph') {
      drawStyledParagraph(block.segments, { size: 12, alignment: block.alignment ?? defaultAlignment(preset) })
    } else {
      ;(block.items ?? []).forEach((item, index) => drawStyledParagraph(item, {
        size: 12,
        indent: 18,
        prefix: block.type === 'ordered-list' ? `${index + 1}. ` : '• ',
      }))
    }
  })
  pdf.save(safeFileName(name, 'pdf'))
}
