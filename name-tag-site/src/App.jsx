import React, { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import Draggable from 'react-draggable'
import { drawTextOnCanvas, loadImageFile } from './lib/image'
import { canvasToPngBlob, exportPdfA4, exportPngZip } from './lib/export'

const defaultState = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 72,
  fontWeight: '600',
  uppercase: false,
  align: 'center',
  fill: '#111111',
  stroke: '#ffffff',
  strokeWidth: 0,
  xPct: 50,
  yPct: 50,
  offsetX: 0,
  offsetY: 0,
  filenamePattern: '{{name}}-nametag.png',
  tagWidthMm: 90,
  marginMm: 10,
}

export default function App() {
  const [templateImg, setTemplateImg] = useState(null)
  const [templateSize, setTemplateSize] = useState({ w: 0, h: 0 })
  const [names, setNames] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvColumn, setCsvColumn] = useState('')
  const [sampleName, setSampleName] = useState('Sample Name')
  const [st, setSt] = useState(defaultState)

  const canvasRef = useRef(null)
  const hiddenCanvasRef = useRef(null)

  const canPreview = !!templateImg

  const onTemplateChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = await loadImageFile(file)
    setTemplateImg(img)
    setTemplateSize({ w: img.width, h: img.height })
  }

  const parseNamesTxt = (value) => {
    const lines = value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    setNames(lines)
  }

  const onCsvUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data || []
        const headers = res.meta?.fields || []
        setCsvHeaders(headers)
        setCsvColumn(headers[0] || '')
        setNames(data.map((row) => (row[headers[0]] || '').toString()).filter(Boolean))
      },
      error: (err) => alert('CSV parse error: ' + err.message),
    })
  }

  const regeneratePreview = () => {
    const canvas = canvasRef.current
    if (!canvas || !templateImg) return
    canvas.width = templateSize.w
    canvas.height = templateSize.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height)
    drawTextOnCanvas(ctx, {
      text: sampleName,
      xPct: st.xPct,
      yPct: st.yPct,
      offsetX: st.offsetX,
      offsetY: st.offsetY,
      align: st.align,
      uppercase: st.uppercase,
      fontFamily: st.fontFamily,
      fontSizePx: st.fontSize,
      fontWeight: st.fontWeight,
      fill: st.fill,
      stroke: st.stroke,
      strokeWidth: st.strokeWidth,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    })
  }

  const onDrag = (e, data) => {
    if (!templateSize.w || !templateSize.h) return
    const xPct = (data.x / templateSize.w) * 100
    const yPct = (data.y / templateSize.h) * 100
    setSt((prev) => ({ ...prev, xPct, yPct }))
  }

  const dragPos = useMemo(() => {
    return {
      x: (st.xPct / 100) * templateSize.w,
      y: (st.yPct / 100) * templateSize.h,
    }
  }, [st.xPct, st.yPct, templateSize])

  React.useEffect(() => {
    regeneratePreview()
  }, [templateImg, sampleName, st, templateSize])

  const handleExportPngZip = async () => {
    if (!templateImg) return
    const hc = hiddenCanvasRef.current
    hc.width = templateSize.w
    hc.height = templateSize.h
    const ctx = hc.getContext('2d')

    const images = []
    for (const name of names.length ? names : [sampleName]) {
      ctx.clearRect(0, 0, hc.width, hc.height)
      ctx.drawImage(templateImg, 0, 0, hc.width, hc.height)
      drawTextOnCanvas(ctx, {
        text: name,
        xPct: st.xPct,
        yPct: st.yPct,
        offsetX: st.offsetX,
        offsetY: st.offsetY,
        align: st.align,
        uppercase: st.uppercase,
        fontFamily: st.fontFamily,
        fontSizePx: st.fontSize,
        fontWeight: st.fontWeight,
        fill: st.fill,
        stroke: st.stroke,
        strokeWidth: st.strokeWidth,
        canvasWidth: hc.width,
        canvasHeight: hc.height,
      })
      const blob = await canvasToPngBlob(hc)
      const safe = (name || 'name').replace(/[^a-z0-9-_ ]/gi, '-').replace(/\s+/g, ' ').trim()
      const filename = (st.filenamePattern || '{{name}}-nametag.png').replace('{{name}}', safe)
      images.push({ name: filename, blob })
    }
    await exportPngZip(images)
  }

  const handleExportPdf = async () => {
    if (!templateImg) return
    const hc = hiddenCanvasRef.current
    hc.width = templateSize.w
    hc.height = templateSize.h
    const ctx = hc.getContext('2d')

    const canvases = []
    for (const name of names.length ? names : [sampleName]) {
      ctx.clearRect(0, 0, hc.width, hc.height)
      ctx.drawImage(templateImg, 0, 0, hc.width, hc.height)
      drawTextOnCanvas(ctx, {
        text: name,
        xPct: st.xPct,
        yPct: st.yPct,
        offsetX: st.offsetX,
        offsetY: st.offsetY,
        align: st.align,
        uppercase: st.uppercase,
        fontFamily: st.fontFamily,
        fontSizePx: st.fontSize,
        fontWeight: st.fontWeight,
        fill: st.fill,
        stroke: st.stroke,
        strokeWidth: st.strokeWidth,
        canvasWidth: hc.width,
        canvasHeight: hc.height,
      })
      // Clone canvas to preserve current drawing for array
      const clone = document.createElement('canvas')
      clone.width = hc.width
      clone.height = hc.height
      clone.getContext('2d').drawImage(hc, 0, 0)
      canvases.push(clone)
    }
    exportPdfA4(canvases, { tagWidthMm: st.tagWidthMm, marginMm: st.marginMm, filename: 'name-tags.pdf' })
  }

  const hasCsv = csvHeaders.length > 0

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Controls */}
        <div className="md:col-span-4 bg-white rounded shadow p-4 space-y-4">
          <h2 className="text-lg font-semibold">Controls</h2>

          <div>
            <div className="section-title mb-1">Template Image</div>
            <input type="file" accept="image/*" onChange={onTemplateChange} className="input" />
          </div>

          <div>
            <div className="section-title mb-1">Names</div>
            <textarea
              placeholder="Paste names here, one per line"
              className="input h-24"
              onChange={(e) => parseNamesTxt(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="file" accept=".csv" onChange={onCsvUpload} />
            <span className="text-xs text-gray-500">or upload CSV</span>
          </div>

          {hasCsv && (
            <div className="flex items-center gap-2">
              <label className="label">CSV Column</label>
              <select
                className="input"
                value={csvColumn}
                onChange={(e) => {
                  const col = e.target.value
                  setCsvColumn(col)
                  setNames((prev) => prev) // keep
                }}
              >
                {csvHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Font Family</label>
              <input className="input" value={st.fontFamily} onChange={(e) => setSt({ ...st, fontFamily: e.target.value })} />
            </div>
            <div>
              <label className="label">Font Size</label>
              <input type="number" className="input" value={st.fontSize} onChange={(e) => setSt({ ...st, fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Weight</label>
              <input className="input" value={st.fontWeight} onChange={(e) => setSt({ ...st, fontWeight: e.target.value })} />
            </div>
            <div>
              <label className="label">Alignment</label>
              <select className="input" value={st.align} onChange={(e) => setSt({ ...st, align: e.target.value })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label className="label">Fill</label>
              <input type="color" className="input" value={st.fill} onChange={(e) => setSt({ ...st, fill: e.target.value })} />
            </div>
            <div>
              <label className="label">Outline</label>
              <input type="color" className="input" value={st.stroke} onChange={(e) => setSt({ ...st, stroke: e.target.value })} />
            </div>
            <div>
              <label className="label">Outline Width</label>
              <input type="number" className="input" value={st.strokeWidth} onChange={(e) => setSt({ ...st, strokeWidth: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="uppercase" type="checkbox" checked={st.uppercase} onChange={(e) => setSt({ ...st, uppercase: e.target.checked })} />
              <label htmlFor="uppercase" className="label">Uppercase</label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Filename Pattern</label>
              <input className="input" value={st.filenamePattern} onChange={(e) => setSt({ ...st, filenamePattern: e.target.value })} />
            </div>
            <div>
              <label className="label">Sample Name</label>
              <input className="input" value={sampleName} onChange={(e) => setSampleName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">PDF Tag Width (mm)</label>
              <input type="number" className="input" value={st.tagWidthMm} onChange={(e) => setSt({ ...st, tagWidthMm: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">PDF Margin (mm)</label>
              <input type="number" className="input" value={st.marginMm} onChange={(e) => setSt({ ...st, marginMm: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={!canPreview} onClick={handleExportPngZip}>Export PNG (ZIP)</button>
            <button className="px-3 py-2 bg-emerald-600 text-white rounded disabled:opacity-50" disabled={!canPreview} onClick={handleExportPdf}>Export PDF (A4)</button>
          </div>
        </div>

        {/* Preview */}
        <div className="md:col-span-8 bg-white rounded shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          {!templateImg && <div className="text-gray-500 text-sm">Upload a template image to begin.</div>}
          {templateImg && (
            <div className="relative inline-block" style={{ width: templateSize.w, height: templateSize.h }}>
              <canvas ref={canvasRef} width={templateSize.w} height={templateSize.h} className="border" />
              <Draggable position={dragPos} onDrag={onDrag}>
                <div className="absolute top-0 left-0 cursor-move select-none bg-black/20 text-white text-xs px-1 rounded">
                  Drag text position
                </div>
              </Draggable>
            </div>
          )}
          <canvas ref={hiddenCanvasRef} className="hidden" />
        </div>
      </div>
    </div>
  )
}


