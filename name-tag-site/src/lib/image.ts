export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageUrl(url)
    return img
  } finally {
    // keep URL for canvas export lifecycle; caller can revoke if needed
  }
}

export function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.crossOrigin = 'anonymous'
    img.src = url
  })
}

export function drawTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  options: {
    text: string
    xPct: number
    yPct: number
    offsetX: number
    offsetY: number
    align: 'left' | 'center' | 'right'
    uppercase: boolean
    fontFamily: string
    fontSizePx: number
    fontWeight: string | number
    fill: string
    stroke?: string
    strokeWidth?: number
    canvasWidth: number
    canvasHeight: number
  }
) {
  const {
    text,
    xPct,
    yPct,
    offsetX,
    offsetY,
    align,
    uppercase,
    fontFamily,
    fontSizePx,
    fontWeight,
    fill,
    stroke,
    strokeWidth = 0,
    canvasWidth,
    canvasHeight,
  } = options

  const content = uppercase ? text.toUpperCase() : text
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`

  const x = (xPct / 100) * canvasWidth + offsetX
  const y = (yPct / 100) * canvasHeight + offsetY

  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = strokeWidth
    ctx.strokeText(content, x, y)
  }

  ctx.fillStyle = fill
  ctx.fillText(content, x, y)
}

export function measureAndFitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  targetWidth: number,
  minPx: number,
  maxPx: number,
  fontWeight: string | number,
  fontStyle: 'normal' | 'italic' | 'oblique' = 'normal',
) {
  const lines: string[] = []
  let fitSize = maxPx
  const clean = (text || '').toString()
  if (!clean) {
    return { size: minPx, lines: [''], lineHeight: minPx * 1.2 }
  }

  const applyFont = (px: number) => {
    ctx.font = `${fontStyle} ${fontWeight} ${px}px ${fontFamily}`
  }

  const measureWidth = (s: string) => ctx.measureText(s).width

  // Shrink-to-fit loop
  for (let px = maxPx; px >= minPx; px -= 1) {
    applyFont(px)
    const w = measureWidth(clean)
    if (w <= targetWidth) {
      fitSize = px
      break
    }
  }

  // If still too wide at min, try soft-wrap (max 2 lines)
  applyFont(fitSize)
  if (measureWidth(clean) > targetWidth) {
    const words = clean.split(/\s+/)
    let first = ''
    let second = ''
    for (let i = 0; i < words.length; i++) {
      const t = (first ? first + ' ' : '') + words[i]
      if (measureWidth(t) <= targetWidth) {
        first = t
      } else {
        // rest into second
        second = words.slice(i).join(' ')
        break
      }
    }
    if (!first) first = clean
    lines.push(first)
    if (second) lines.push(second)
  } else {
    lines.push(clean)
  }

  const metrics = ctx.measureText('Mg')
  const lineHeight = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || fitSize * 1.2
  return { size: fitSize, lines, lineHeight }
}



