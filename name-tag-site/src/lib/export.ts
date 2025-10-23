import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'

export type TextStyle = {
  fontFamily: string
  fontSizePx: number
  fontWeight: string | number
  fontStyle?: 'normal' | 'italic' | 'oblique'
  fill: string
  stroke?: string
  strokeWidth?: number
  uppercase?: boolean
}

function setFont(ctx: CanvasRenderingContext2D, style: TextStyle) {
  const fontStyle = style.fontStyle || 'normal'
  ctx.font = `${fontStyle} ${style.fontWeight} ${style.fontSizePx}px ${style.fontFamily}`
}

function measureMiddleHeight(ctx: CanvasRenderingContext2D, text: string) {
  const m = ctx.measureText(text)
  const ascent = (m.actualBoundingBoxAscent || 0)
  const descent = (m.actualBoundingBoxDescent || 0)
  return ascent + descent
}

export function drawNameSubtitleOnCtx(
  ctx: CanvasRenderingContext2D,
  options: {
    name: string
    subtitle?: string
    xPct: number
    yPct: number
    offsetX: number
    offsetY: number
    align: 'left' | 'center' | 'right'
    nameStyle: TextStyle
    subtitleStyle: TextStyle
    lineGapPx: number
    canvasWidth: number
    canvasHeight: number
  }
) {
  const {
    name,
    subtitle,
    xPct,
    yPct,
    offsetX,
    offsetY,
    align,
    nameStyle,
    subtitleStyle,
    lineGapPx,
    canvasWidth,
    canvasHeight,
  } = options

  ctx.textBaseline = 'middle'
  ctx.textAlign = align

  const nameText = nameStyle.uppercase ? (name || '').toUpperCase() : (name || '')
  const subTextRaw = subtitleStyle.uppercase ? (subtitle || '').toUpperCase() : (subtitle || '')
  const hasSubtitle = !!subTextRaw

  const x = (xPct / 100) * canvasWidth + offsetX
  const yMid = (yPct / 100) * canvasHeight + offsetY

  // Name first
  setFont(ctx, nameStyle)
  const nameH = measureMiddleHeight(ctx, nameText)
  const yName = yMid
  if (nameStyle.stroke && (nameStyle.strokeWidth || 0) > 0) {
    ctx.strokeStyle = nameStyle.stroke
    ctx.lineWidth = nameStyle.strokeWidth || 0
    ctx.strokeText(nameText, x, yName)
  }
  ctx.fillStyle = nameStyle.fill
  ctx.fillText(nameText, x, yName)

  if (hasSubtitle) {
    setFont(ctx, subtitleStyle)
    const subH = measureMiddleHeight(ctx, subTextRaw)
    const ySub = yName + (nameH / 2) + lineGapPx + (subH / 2)
    if (subtitleStyle.stroke && (subtitleStyle.strokeWidth || 0) > 0) {
      ctx.strokeStyle = subtitleStyle.stroke
      ctx.lineWidth = subtitleStyle.strokeWidth || 0
      ctx.strokeText(subTextRaw, x, ySub)
    }
    ctx.fillStyle = subtitleStyle.fill
    ctx.fillText(subTextRaw, x, ySub)
  }
}

export async function exportPngZip(
  images: { name: string; blob: Blob }[],
  zipName = 'name-tags.zip'
) {
  const zip = new JSZip()
  for (const { name, blob } of images) {
    zip.file(name, blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, zipName)
}

export function canvasToPngBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create PNG blob'))
    }, 'image/png', quality)
  })
}

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export function exportPdfA4(
  canvases: HTMLCanvasElement[],
  options: { tagWidthMm: number; marginMm: number; filename?: string }
) {
  const { tagWidthMm, marginMm, filename = 'name-tags.pdf' } = options
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  if (canvases.length === 0) {
    doc.save(filename)
    return
  }

  const ref = canvases[0]
  const ar = ref.width / ref.height
  const tagW = mmToPt(tagWidthMm)
  const tagH = tagW / ar
  const margin = mmToPt(marginMm)

  const cols = Math.max(1, Math.floor((pageW - 2 * margin) / tagW))
  const rows = Math.max(1, Math.floor((pageH - 2 * margin) / tagH))

  let x = margin
  let y = margin
  let col = 0
  let row = 0

  canvases.forEach((canvas, idx) => {
    const dataUrl = canvas.toDataURL('image/png')
    if (idx > 0 && col === 0 && row === 0) {
      doc.addPage()
    }
    doc.addImage(dataUrl, 'PNG', x, y, tagW, tagH, undefined, 'FAST')
    col += 1
    if (col >= cols) {
      col = 0
      row += 1
      x = margin
      y += tagH
      if (row >= rows) {
        row = 0
        x = margin
        y = margin
      }
    } else {
      x += tagW
    }
  })

  doc.save(filename)
}


