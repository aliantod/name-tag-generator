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


