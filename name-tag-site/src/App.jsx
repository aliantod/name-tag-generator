import React, { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import Draggable from 'react-draggable'
import { Rnd } from 'react-rnd'
import { drawTextOnCanvas, loadImageFile } from './lib/image'
import { canvasToPngBlob, exportPdfA4, exportPngZip, drawNameSubtitleOnCtx, drawWithinBox, exportPdfA4Custom } from './lib/export'

const defaultState = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 72,
  fontWeight: '600',
  uppercase: false,
  align: 'center',
  fill: '#111111',
  stroke: '#ffffff',
  strokeWidth: 0,
  subFontSize: 36,
  subFontWeight: '500',
  subItalic: false,
  subFill: '#333333',
  subStroke: '#ffffff',
  subStrokeWidth: 0,
  subUppercase: false,
  lineGapPx: 22,
  lineGapScale: 1,
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
  const [subtitles, setSubtitles] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [csvNameCol, setCsvNameCol] = useState('')
  const [csvSubCol, setCsvSubCol] = useState('')
  const [sampleName, setSampleName] = useState('Sample Name')
  const [sampleSubtitle, setSampleSubtitle] = useState('Sample Subtitle')
  const [st, setSt] = useState(defaultState)

  // Bounding box state
  const [useBox, setUseBox] = useState(false)
  const [showGuides, setShowGuides] = useState(true)
  const [box, setBox] = useState({ xPct: 20, yPct: 35, wPct: 60, hPct: 30 })
  const [nameMin, setNameMin] = useState(32)
  const [nameMax, setNameMax] = useState(72)
  const [subMin, setSubMin] = useState(18)
  const [subMax, setSubMax] = useState(48)
  const [useCustomPdf, setUseCustomPdf] = useState(true)
  const customRects = useMemo(() => ([
    // Three horizontal left column
    { x: 15, y: 26, w: 321.3, h: 207.87 },
    { x: 15, y: 292, w: 321.3, h: 207.87 },
    { x: 15, y: 558, w: 321.3, h: 207.87 },
    // Two vertical right column
    // A4 width ≈ 595pt: set right margin to 15pt -> x = 595 - 15 - 207.87 = 372.13
    { x: 372.13, y: 26, w: 321.3, h: 207.87, rotate: 90 },
    { x: 372.13, y: 376, w: 321.3, h: 207.87, rotate: 90 },
  ]), [])

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
        setCsvRows(data)
        const nameCol = headers[0] || ''
        const subCol = headers[1] || ''
        setCsvNameCol(nameCol)
        setCsvSubCol(subCol)
        const newNames = data.map((row) => (row[nameCol] || '').toString())
        const newSubs = data.map((row) => (subCol ? (row[subCol] || '').toString() : ''))
        setNames(newNames)
        setSubtitles(newSubs)
        if (newNames[0]) setSampleName(newNames[0])
        if (newSubs[0]) setSampleSubtitle(newSubs[0])
      },
      error: (err) => alert('CSV parse error: ' + err.message),
    })
  }

  // Recompute names/subtitles automatically when user changes selected columns
  React.useEffect(() => {
    if (!csvRows.length || !csvHeaders.length) return
    if (!csvNameCol && !csvSubCol) return
    const newNames = csvRows.map((row) => (csvNameCol ? (row[csvNameCol] || '').toString() : ''))
    const newSubs = csvRows.map((row) => (csvSubCol ? (row[csvSubCol] || '').toString() : ''))
    setNames(newNames)
    setSubtitles(newSubs)
    if (newNames[0]) setSampleName(newNames[0])
    if (newSubs[0]) setSampleSubtitle(newSubs[0])
  }, [csvRows, csvNameCol, csvSubCol, csvHeaders])

  const regeneratePreview = () => {
    const canvas = canvasRef.current
    if (!canvas || !templateImg) return
    canvas.width = templateSize.w
    canvas.height = templateSize.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height)
    if (useBox) {
      const b = {
        x: (box.xPct / 100) * canvas.width,
        y: (box.yPct / 100) * canvas.height,
        w: (box.wPct / 100) * canvas.width,
        h: (box.hPct / 100) * canvas.height,
      }
      drawWithinBox(ctx, {
        name: sampleName,
        subtitle: sampleSubtitle,
        box: b,
        align: st.align,
        nameStyle: {
          fontFamily: st.fontFamily,
          fontSizePx: st.fontSize,
          fontWeight: st.fontWeight,
          fontStyle: 'normal',
          fill: st.fill,
          stroke: st.stroke,
          strokeWidth: st.strokeWidth,
          uppercase: st.uppercase,
          minPx: nameMin,
          maxPx: nameMax,
        },
        subtitleStyle: {
          fontFamily: st.fontFamily,
          fontSizePx: st.subFontSize,
          fontWeight: st.subFontWeight,
          fontStyle: st.subItalic ? 'italic' : 'normal',
          fill: st.subFill,
          stroke: st.subStroke,
          strokeWidth: st.subStrokeWidth,
          uppercase: st.subUppercase,
          minPx: subMin,
          maxPx: subMax,
        },
        lineGapPx: st.lineGapPx,
        lineGapScale: st.lineGapScale,
      })
      if (showGuides) {
        ctx.save()
        ctx.setLineDash([6, 6])
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.strokeRect(b.x, b.y, b.w, b.h)
        ctx.fillStyle = 'rgba(0,0,0,0.05)'
        ctx.fillRect(b.x, b.y, b.w, b.h)
        ctx.restore()
      }
    } else {
      drawNameSubtitleOnCtx(ctx, {
        name: sampleName,
        subtitle: sampleSubtitle,
        xPct: st.xPct,
        yPct: st.yPct,
        offsetX: st.offsetX,
        offsetY: st.offsetY,
        align: st.align,
        nameStyle: {
          fontFamily: st.fontFamily,
          fontSizePx: st.fontSize,
          fontWeight: st.fontWeight,
          fill: st.fill,
          stroke: st.stroke,
          strokeWidth: st.strokeWidth,
          uppercase: st.uppercase,
        },
        subtitleStyle: {
          fontFamily: st.fontFamily,
          fontSizePx: st.subFontSize,
          fontWeight: st.subFontWeight,
          fontStyle: st.subItalic ? 'italic' : 'normal',
          fill: st.subFill,
          stroke: st.subStroke,
          strokeWidth: st.subStrokeWidth,
          uppercase: st.subUppercase,
        },
        lineGapPx: st.lineGapPx,
        lineGapScale: st.lineGapScale,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      })
    }
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
    const rows = (names.length ? names : [sampleName]).map((n, i) => ({
      name: n,
      sub: (names.length ? subtitles[i] : sampleSubtitle) || '',
    }))
    for (const row of rows) {
      ctx.clearRect(0, 0, hc.width, hc.height)
      ctx.drawImage(templateImg, 0, 0, hc.width, hc.height)
      if (useBox) {
        const b = {
          x: (box.xPct / 100) * hc.width,
          y: (box.yPct / 100) * hc.height,
          w: (box.wPct / 100) * hc.width,
          h: (box.hPct / 100) * hc.height,
        }
        drawWithinBox(ctx, {
          name: row.name,
          subtitle: row.sub,
          box: b,
          align: st.align,
          nameStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.fontSize,
            fontWeight: st.fontWeight,
            fontStyle: 'normal',
            fill: st.fill,
            stroke: st.stroke,
            strokeWidth: st.strokeWidth,
            uppercase: st.uppercase,
            minPx: nameMin,
            maxPx: nameMax,
          },
          subtitleStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.subFontSize,
            fontWeight: st.subFontWeight,
            fontStyle: st.subItalic ? 'italic' : 'normal',
            fill: st.subFill,
            stroke: st.subStroke,
            strokeWidth: st.subStrokeWidth,
            uppercase: st.subUppercase,
            minPx: subMin,
            maxPx: subMax,
          },
          lineGapPx: st.lineGapPx,
          lineGapScale: st.lineGapScale,
        })
      } else {
        drawNameSubtitleOnCtx(ctx, {
          name: row.name,
          subtitle: row.sub,
          xPct: st.xPct,
          yPct: st.yPct,
          offsetX: st.offsetX,
          offsetY: st.offsetY,
          align: st.align,
          nameStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.fontSize,
            fontWeight: st.fontWeight,
            fill: st.fill,
            stroke: st.stroke,
            strokeWidth: st.strokeWidth,
            uppercase: st.uppercase,
          },
          subtitleStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.subFontSize,
            fontWeight: st.subFontWeight,
            fontStyle: st.subItalic ? 'italic' : 'normal',
            fill: st.subFill,
            stroke: st.subStroke,
            strokeWidth: st.subStrokeWidth,
            uppercase: st.subUppercase,
          },
          lineGapPx: st.lineGapPx,
          lineGapScale: st.lineGapScale,
          canvasWidth: hc.width,
          canvasHeight: hc.height,
        })
      }
      const blob = await canvasToPngBlob(hc)
      const safeName = (row.name || 'name').replace(/[^a-z0-9-_ ]/gi, '-').replace(/\s+/g, ' ').trim()
      const safeSub = (row.sub || '').replace(/[^a-z0-9-_ ]/gi, '-').replace(/\s+/g, ' ').trim()
      let filename = (st.filenamePattern || '{{name}}-nametag.png').replace('{{name}}', safeName)
      filename = filename.replace('{{subtitle}}', safeSub)
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
    const rows = (names.length ? names : [sampleName]).map((n, i) => ({
      name: n,
      sub: (names.length ? subtitles[i] : sampleSubtitle) || '',
    }))
    for (const row of rows) {
      ctx.clearRect(0, 0, hc.width, hc.height)
      ctx.drawImage(templateImg, 0, 0, hc.width, hc.height)
      if (useBox) {
        const b = {
          x: (box.xPct / 100) * hc.width,
          y: (box.yPct / 100) * hc.height,
          w: (box.wPct / 100) * hc.width,
          h: (box.hPct / 100) * hc.height,
        }
        drawWithinBox(ctx, {
          name: row.name,
          subtitle: row.sub,
          box: b,
          align: st.align,
          nameStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.fontSize,
            fontWeight: st.fontWeight,
            fontStyle: 'normal',
            fill: st.fill,
            stroke: st.stroke,
            strokeWidth: st.strokeWidth,
            uppercase: st.uppercase,
            minPx: nameMin,
            maxPx: nameMax,
          },
          subtitleStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.subFontSize,
            fontWeight: st.subFontWeight,
            fontStyle: st.subItalic ? 'italic' : 'normal',
            fill: st.subFill,
            stroke: st.subStroke,
            strokeWidth: st.subStrokeWidth,
            uppercase: st.subUppercase,
            minPx: subMin,
            maxPx: subMax,
          },
          lineGapPx: st.lineGapPx,
          lineGapScale: st.lineGapScale,
        })
      } else {
        drawNameSubtitleOnCtx(ctx, {
          name: row.name,
          subtitle: row.sub,
          xPct: st.xPct,
          yPct: st.yPct,
          offsetX: st.offsetX,
          offsetY: st.offsetY,
          align: st.align,
          nameStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.fontSize,
            fontWeight: st.fontWeight,
            fill: st.fill,
            stroke: st.stroke,
            strokeWidth: st.strokeWidth,
            uppercase: st.uppercase,
          },
          subtitleStyle: {
            fontFamily: st.fontFamily,
            fontSizePx: st.subFontSize,
            fontWeight: st.subFontWeight,
            fontStyle: st.subItalic ? 'italic' : 'normal',
            fill: st.subFill,
            stroke: st.subStroke,
            strokeWidth: st.subStrokeWidth,
            uppercase: st.subUppercase,
          },
          lineGapPx: st.lineGapPx,
          lineGapScale: st.lineGapScale,
          canvasWidth: hc.width,
          canvasHeight: hc.height,
        })
      }
      // Clone canvas to preserve current drawing for array
      const clone = document.createElement('canvas')
      clone.width = hc.width
      clone.height = hc.height
      clone.getContext('2d').drawImage(hc, 0, 0)
      canvases.push(clone)
    }
    if (useCustomPdf) {
      exportPdfA4Custom(canvases, { rects: customRects, filename: 'name-tags.pdf' })
    } else {
      exportPdfA4(canvases, { tagWidthMm: st.tagWidthMm, marginMm: st.marginMm, filename: 'name-tags.pdf' })
    }
  }

  const hasCsv = csvHeaders.length > 0

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Controls */}
        <div className="md:col-span-4 bg-white rounded shadow p-4 space-y-4">
          <h2 className="text-lg font-semibold">Controls</h2>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Font Preset</label>
              <select
                className="input"
                value={st.fontFamily}
                onChange={(e) => setSt({ ...st, fontFamily: e.target.value })}
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Montserrat, sans-serif">Montserrat</option>
                <option value="Poppins, sans-serif">Poppins</option>
                <option value="Open Sans, sans-serif">Open Sans</option>
                <option value="Lato, sans-serif">Lato</option>
                <option value="Nunito, sans-serif">Nunito</option>
                <option value={st.fontFamily}>Custom (use below)</option>
              </select>
            </div>
            <div>
              <label className="label">Font Family (custom)</label>
              <input className="input" value={st.fontFamily} onChange={(e) => setSt({ ...st, fontFamily: e.target.value })} />
            </div>
          </div>

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
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <label className="label">Name Column</label>
                <select
                  className="input"
                  value={csvNameCol}
                  onChange={(e) => setCsvNameCol(e.target.value)}
                >
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="label">Subtitle Column</label>
                <select
                  className="input"
                  value={csvSubCol}
                  onChange={(e) => setCsvSubCol(e.target.value)}
                >
                  <option value="">(none)</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
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

          <div className="section-title mt-2">Subtitle</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Font Size</label>
              <input type="number" className="input" value={st.subFontSize} onChange={(e) => setSt({ ...st, subFontSize: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Weight</label>
              <input className="input" value={st.subFontWeight} onChange={(e) => setSt({ ...st, subFontWeight: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="subBold" type="checkbox" checked={String(st.subFontWeight) === '700'} onChange={(e) => setSt({ ...st, subFontWeight: e.target.checked ? '700' : '500' })} />
              <label htmlFor="subBold" className="label">Bold</label>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="subItalic" type="checkbox" checked={st.subItalic} onChange={(e) => setSt({ ...st, subItalic: e.target.checked })} />
              <label htmlFor="subItalic" className="label">Italic</label>
            </div>
            <div>
              <label className="label">Fill</label>
              <input type="color" className="input" value={st.subFill} onChange={(e) => setSt({ ...st, subFill: e.target.value })} />
            </div>
            <div>
              <label className="label">Outline</label>
              <input type="color" className="input" value={st.subStroke} onChange={(e) => setSt({ ...st, subStroke: e.target.value })} />
            </div>
            <div>
              <label className="label">Outline Width</label>
              <input type="number" className="input" value={st.subStrokeWidth} onChange={(e) => setSt({ ...st, subStrokeWidth: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input id="subUppercase" type="checkbox" checked={st.subUppercase} onChange={(e) => setSt({ ...st, subUppercase: e.target.checked })} />
              <label htmlFor="subUppercase" className="label">Uppercase</label>
            </div>
            <div>
              <label className="label">Line Gap (px)</label>
              <input type="number" className="input" value={st.lineGapPx} onChange={(e) => setSt({ ...st, lineGapPx: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Line Gap Scale (×)</label>
              <input type="number" step="0.1" min="0" className="input" value={st.lineGapScale} onChange={(e) => setSt({ ...st, lineGapScale: Number(e.target.value) })} />
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
            <div className="flex items-center gap-2 mt-2">
              <input id="useCustomPdf" type="checkbox" checked={useCustomPdf} onChange={(e) => setUseCustomPdf(e.target.checked)} />
              <label htmlFor="useCustomPdf" className="label">Use custom A4 layout</label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={!canPreview} onClick={handleExportPngZip}>Export PNG (ZIP)</button>
            <button className="px-3 py-2 bg-emerald-600 text-white rounded disabled:opacity-50" disabled={!canPreview} onClick={handleExportPdf}>Export PDF (A4)</button>
          </div>

          <div className="section-title mt-4">Bounding Box</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <input id="lockToBox" type="checkbox" checked={useBox} onChange={(e) => setUseBox(e.target.checked)} />
              <label htmlFor="lockToBox" className="label">Lock text to bounding box</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="showGuides" type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
              <label htmlFor="showGuides" className="label">Show guides</label>
            </div>
            <div>
              <label className="label">Name Min Px</label>
              <input type="number" className="input" value={nameMin} onChange={(e) => setNameMin(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Name Max Px</label>
              <input type="number" className="input" value={nameMax} onChange={(e) => setNameMax(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Subtitle Min Px</label>
              <input type="number" className="input" value={subMin} onChange={(e) => setSubMin(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Subtitle Max Px</label>
              <input type="number" className="input" value={subMax} onChange={(e) => setSubMax(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="md:col-span-8 bg-white rounded shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          {!templateImg && <div className="text-gray-500 text-sm">Upload a template image to begin.</div>}
          {templateImg && (
            <div className="relative inline-block" style={{ width: templateSize.w, height: templateSize.h }}>
              <canvas ref={canvasRef} width={templateSize.w} height={templateSize.h} className="border" />
              {!useBox && (
                <Draggable position={dragPos} onDrag={onDrag}>
                  <div className="absolute top-0 left-0 cursor-move select-none bg-black/20 text-white text-xs px-1 rounded">
                    Drag text position
                  </div>
                </Draggable>
              )}
              {useBox && (
                <Rnd
                  bounds="parent"
                  size={{ width: (box.wPct/100)*templateSize.w, height: (box.hPct/100)*templateSize.h }}
                  position={{ x: (box.xPct/100)*templateSize.w, y: (box.yPct/100)*templateSize.h }}
                  onDragStop={(e, d) => {
                    const xPct = (d.x / templateSize.w) * 100
                    const yPct = (d.y / templateSize.h) * 100
                    setBox((prev) => ({ ...prev, xPct, yPct }))
                  }}
                  onResizeStop={(e, dir, ref, delta, pos) => {
                    const wPct = (ref.offsetWidth / templateSize.w) * 100
                    const hPct = (ref.offsetHeight / templateSize.h) * 100
                    const xPct = (pos.x / templateSize.w) * 100
                    const yPct = (pos.y / templateSize.h) * 100
                    setBox({ xPct, yPct, wPct, hPct })
                  }}
                  style={{ border: '2px dashed #666', background: 'rgba(0,0,0,0.04)' }}
                />
              )}
            </div>
          )}
          <canvas ref={hiddenCanvasRef} className="hidden" />
        </div>
      </div>
    </div>
  )
}


