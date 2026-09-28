import type { Register } from 'claude-code'

const TOOL = 'mcp__whiteboard-defense__draw'

// Shared look, so the model writes only shapes: classes instead of styling.
const STYLE = `
  text { font-family: Helvetica, Arial, sans-serif; font-size: 16px; text-anchor: middle; dominant-baseline: central; fill: #222 }
  .box { fill: #eef; stroke: #335; stroke-width: 1.5 }
  .edge { fill: none; stroke: #335; stroke-width: 2; marker-end: url(#arrow) }
  .async { stroke: #c63; stroke-dasharray: 6 4 }
  .label { font-size: 13px; fill: #555 }
  .badge circle { fill: #f93 } .badge text { fill: #fff; font-size: 14px }
`
const ARROW = '<marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#335"/></marker>'

const DESCRIPTION = `Draws a diagram as a picture in the user's terminal, and shows it to you too so you can check it. Pass the SVG *body* (no <svg> root) and the canvas size; keep it under ~7 boxes.
Classes provided: rect.box, path.edge (arrow at the end; add class "async" for dashed orange: background/external calls), text.label (small grey edge label), g.badge (a numbered orange circle: <g class="badge" transform="translate(x,y)"><circle r="13"/><text>1</text></g>). Text is centered on its x,y.
alt: the same diagram as plain text, shown where pictures can't be.`

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'draw',
      description: DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          width: { type: 'number', description: 'Canvas width in px, at most 1000' },
          height: { type: 'number', description: 'Canvas height in px, at most 1000' },
          body: { type: 'string', description: 'SVG elements to draw, without the <svg> root' },
          alt: { type: 'string', description: 'The diagram as plain text' },
        },
        required: ['width', 'height', 'body', 'alt'],
      },
    })
    return next(e)
  })

  // Answers the call itself: SVG -> PNG with macOS's own renderer.
  on('tool.call', { tool: TOOL }, async ($, e) => {
    const width = Math.round(Number(e.width)), height = Math.round(Number(e.height))
    if (!(width > 0 && width <= 1000 && height > 0 && height <= 1000)) {
      return { deny: 'width and height must be 1 to 1000' }
    }
    // qlmanage renders into a square with the picture at the top; centered in
    // the square instead, sips' center crop takes exactly the picture back.
    const side = Math.max(width, height)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">`
      + `<style>${STYLE}</style><defs>${ARROW}</defs><rect width="${side}" height="${side}" fill="#fff"/>`
      + `<g transform="translate(${(side - width) / 2},${(side - height) / 2})">${e.body}</g></svg>`

    try {
      const dir = (await $.process.run(['mktemp', '-d'])).stdout.trim()
      const file = `${dir}/board.svg`
      await $.fs.write(file, svg)
      await $.process.run(['qlmanage', '-t', '-s', String(side * 2), '-o', dir, file])
      const png = `${file}.png`
      const crop = await $.process.run(['sips', '-c', String(height * 2), String(width * 2), png])
      if (crop.exitCode !== 0) throw new Error(crop.stderr)
      const { base64 } = await $.fs.read(png, { as: 'bytes' })
      return {
        result: [
          // Messages API shape: core hands these blocks to the model as they are.
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: `Drawn. Check it for arrows that miss their box or overlapping text; call again to fix.\n\n${e.alt}` },
        ],
      }
    } catch (err) {
      // ponytail: macOS only (qlmanage, sips); a cross-platform renderer if others need it
      return { result: `Could not draw (${err}). Show the user this text diagram instead:\n\n${e.alt}` }
    }
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.props.tool !== TOOL || e.surface !== 'terminal') return next(e)
    const out = e.props.output as any
    const blocks: any[] = Array.isArray(out) ? out : out?.content ?? []
    const data: string | undefined = blocks.find((b) => b?.type === 'image')?.source?.data
    const alt: string = blocks.find((b) => b?.type === 'text')?.text ?? ' '
    if (!data) return next(e)

    // PNG header: width and height are big-endian at bytes 16 and 20.
    const head = atob(data.slice(0, 32))
    const u32 = (at: number) => ((head.charCodeAt(at) << 24) | (head.charCodeAt(at + 1) << 16) | (head.charCodeAt(at + 2) << 8) | head.charCodeAt(at + 3)) >>> 0
    const { columns, rows } = fit(u32(16), u32(20), e.viewport?.columns ?? 80)
    const { Image } = $.ui.resolve(e)
    return <Image source={{ png: data }} columns={columns} rows={rows} alt={alt} />
  })
}

// The picture's size in terminal cells.
function fit(pxWidth: number, pxHeight: number, termColumns: number) {
  const columns = Math.min(termColumns - 4, 110)
  // A cell is about twice as tall as it is wide.
  const rows = Math.round((columns * pxHeight) / pxWidth / 2)
  return { columns: Math.max(1, Math.min(columns, 255)), rows: Math.max(1, Math.min(rows, 255)) }
}
