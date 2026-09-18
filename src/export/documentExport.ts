import type { JSONContent } from '@tiptap/core'

export type ExportFormat = 'docx' | 'pdf'

interface TextSegment {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize?: number
}

interface DocumentBlock {
  type: 'heading' | 'paragraph' | 'ordered-list' | 'bullet-list'
  level?: number
  alignment?: string
  segments?: TextSegment[]
  items?: TextSegment[][]
}

function getMarks(node: JSONContent): TextSegment {
  const marks = node.marks ?? []
  const fontSize = marks.find((mark) => mark.type === 'textStyle')?.attrs?.fontSize

  return {
    text: node.text ?? '',
    bold: marks.some((mark) => mark.type === 'bold'),
    italic: marks.some((mark) => mark.type === 'italic'),
    underline: marks.some((mark) => mark.type === 'underline'),
    fontSize: typeof fontSize === 'string' ? Number.parseFloat(fontSize) : undefined,
  }
}

function textSegments(nodes: JSONContent[] = []): TextSegment[] {
  return nodes.flatMap((node) => {
    if (node.type === 'text') return [getMarks(node)]
    if (node.type === 'hardBreak') return [{ text: '\n', bold: false, italic: false, underline: false }]
    return textSegments(node.content)
  })
}

function documentBlocks(content: JSONContent): DocumentBlock[] {
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

function fileName(format: ExportFormat): string {
  return `atividade-01.${format}`
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

export async function exportDocument(content: JSONContent, format: ExportFormat): Promise<void> {
  if (format === 'docx') {
    await exportDocx(content)
    return
  }

  await exportPdf(content)
}

async function exportDocx(content: JSONContent): Promise<void> {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    LevelFormat,
    Packer,
    Paragraph,
    TextRun,
    UnderlineType,
  } = await import('docx')

  const alignment = (value?: string) => {
    if (value === 'center') return AlignmentType.CENTER
    if (value === 'right') return AlignmentType.RIGHT
    if (value === 'justify') return AlignmentType.JUSTIFIED
    return AlignmentType.LEFT
  }

  const runs = (segments: TextSegment[] = []) => segments.map((segment) => new TextRun({
    text: segment.text,
    bold: segment.bold,
    italics: segment.italic,
    underline: segment.underline ? { type: UnderlineType.SINGLE } : undefined,
    size: segment.fontSize ? Math.round(segment.fontSize * 2) : undefined,
  }))

  const children = documentBlocks(content).flatMap((block) => {
    if (block.type === 'heading') {
      return [new Paragraph({
        children: runs(block.segments),
        heading: block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        alignment: alignment(block.alignment),
      })]
    }

    if (block.type === 'paragraph') {
      return [new Paragraph({ children: runs(block.segments), alignment: alignment(block.alignment) })]
    }

    return (block.items ?? []).map((item) => new Paragraph({
      children: runs(item),
      ...(block.type === 'ordered-list'
        ? { numbering: { reference: 'ordered-list', level: 0 } }
        : { bullet: { level: 0 } }),
    }))
  })

  const document = new Document({
    numbering: {
      config: [{
        reference: 'ordered-list',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: children.length ? children : [new Paragraph('')],
    }],
  })

  download(await Packer.toBlob(document), fileName('docx'))
}

function segmentText(segments: TextSegment[] = []): string {
  return segments.map((segment) => segment.text).join('')
}

async function exportPdf(content: JSONContent): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 54
  const usableWidth = pageWidth - margin * 2
  let cursorY = margin

  const addPageIfNeeded = (height: number) => {
    if (cursorY + height <= pageHeight - margin) return
    pdf.addPage()
    cursorY = margin
  }

  const drawParagraph = (text: string, options: { size: number; style?: 'normal' | 'bold'; alignment?: string; prefix?: string }) => {
    const value = `${options.prefix ?? ''}${text}` || ' '
    pdf.setFont('helvetica', options.style ?? 'normal')
    pdf.setFontSize(options.size)
    const lines = pdf.splitTextToSize(value, usableWidth) as string[]
    const lineHeight = options.size * 1.45

    lines.forEach((line) => {
      addPageIfNeeded(lineHeight)
      const textWidth = pdf.getTextWidth(line)
      const x = options.alignment === 'center'
        ? (pageWidth - textWidth) / 2
        : options.alignment === 'right'
          ? pageWidth - margin - textWidth
          : margin
      pdf.text(line, x, cursorY)
      cursorY += lineHeight
    })
    cursorY += options.size * 0.45
  }

  documentBlocks(content).forEach((block) => {
    if (block.type === 'heading') {
      drawParagraph(segmentText(block.segments), {
        size: block.level === 2 ? 18 : 24,
        style: 'bold',
        alignment: block.alignment,
      })
      return
    }

    if (block.type === 'paragraph') {
      drawParagraph(segmentText(block.segments), { size: 11, alignment: block.alignment })
      return
    }

    ;(block.items ?? []).forEach((item, index) => {
      drawParagraph(segmentText(item), {
        size: 11,
        prefix: block.type === 'ordered-list' ? `${index + 1}. ` : '• ',
      })
    })
  })

  pdf.save(fileName('pdf'))
}
