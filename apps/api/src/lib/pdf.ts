/**
 * Builds a minimal valid text PDF (Helvetica, one line per entry, 52 lines per page). Used for the
 * demo account's resume files and upload tests — not a general PDF writer (Latin-1 text only).
 */
const LINES_PER_PAGE = 52

/** Standard fonts are Latin-1: map common typographic characters, drop the rest. */
const latin1 = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\xFF]/g, '')

export function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => latin1(s).replace(/[\\()]/g, (c) => `\\${c}`)
  const pages: string[][] = []
  for (let i = 0; i < Math.max(lines.length, 1); i += LINES_PER_PAGE)
    pages.push(lines.slice(i, i + LINES_PER_PAGE))
  // Objects: 1 catalog, 2 pages, 3 font, then (page, content) pairs.
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  pages.forEach((pageLines, i) => {
    const stream = [
      'BT /F1 11 Tf 14 TL 50 780 Td',
      ...pageLines.map((l) => `(${esc(l)}) Tj T*`),
      'ET',
    ].join('\n')
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    )
  })
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
