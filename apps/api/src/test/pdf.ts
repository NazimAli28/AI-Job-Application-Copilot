/** Test PDFs: the builder lives in lib/pdf.ts (also used for the demo account's resumes). */
export { makePdf } from '../lib/pdf'

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
