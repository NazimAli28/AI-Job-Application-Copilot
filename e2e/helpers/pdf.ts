/** Builds a minimal valid text PDF (one page, Helvetica, one line per entry) for upload tests. */
export function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const stream = [
    'BT /F1 11 Tf 14 TL 50 780 Td',
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    'ET',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

export const sampleResumeLines = [
  'Alice Doe',
  'alice@example.com | Berlin',
  'SUMMARY',
  'Frontend engineer building React and TypeScript apps.',
  'EXPERIENCE',
  'Frontend Engineer - Acme',
  '2021 - Present',
  '- Responsible for the design system used by 5 teams',
  '- Built a React dashboard with TypeScript and Node.js',
  'EDUCATION',
  'TU Berlin - BSc Computer Science',
  '2020',
  'SKILLS',
  'React, TypeScript, Node.js, PostgreSQL',
]
