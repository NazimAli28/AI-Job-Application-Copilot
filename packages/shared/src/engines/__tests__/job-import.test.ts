import { describe, expect, it } from 'vitest'
import { detectJobProvider, extractJobFromHtml, htmlToText, jobFromGreenhouse, jobFromLever } from '../job-import'

const GH_CONTENT_HTML =
  '<p><strong>About Acme Cloud</strong></p><p>We build developer tooling.</p><h3>What you&#39;ll do</h3><ul><li>Build React &amp; TypeScript interfaces</li><li>Own our design system</li></ul><h3>Requirements</h3><ul><li>3+ years of experience with React and TypeScript</li><li>Bachelor&#39;s degree in Computer Science</li></ul><h3>Nice to have</h3><ul><li>GraphQL</li></ul>'
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const GH_JOB = {
  id: 4012345,
  title: 'Senior Frontend Engineer',
  location: { name: 'Remote - US' },
  absolute_url: 'https://boards.greenhouse.io/acmecloud/jobs/4012345',
  content: escapeHtml(GH_CONTENT_HTML),
}

const LEVER_JOB = {
  id: '5d3f1c3e-1111-4222-8333-444455556666',
  text: 'Backend Engineer',
  categories: { location: 'Berlin, Germany', commitment: 'Full-time', team: 'Platform' },
  workplaceType: 'hybrid',
  descriptionPlain: 'Join Northwind to build reliable APIs with Node.js and PostgreSQL.',
  lists: [
    { text: 'What you will do', content: '<li>Design REST APIs</li><li>Operate services on AWS</li>' },
    { text: 'Requirements', content: '<li>2+ years of experience with Node.js</li><li>Strong SQL skills</li>' },
  ],
  additionalPlain: 'We are an equal opportunity employer.',
  hostedUrl: 'https://jobs.lever.co/northwind/5d3f1c3e-1111-4222-8333-444455556666',
}

describe('detectJobProvider', () => {
  it('maps Greenhouse board URLs to the boards API', () => {
    const expected = { provider: 'greenhouse', apiUrl: 'https://boards-api.greenhouse.io/v1/boards/acmecloud/jobs/4012345' }
    expect(detectJobProvider('https://boards.greenhouse.io/acmecloud/jobs/4012345')).toEqual(expected)
    expect(detectJobProvider('https://job-boards.greenhouse.io/acmecloud/jobs/4012345?gh_src=x')).toEqual(expected)
  })
  it('maps Lever URLs (with /apply suffix) to the postings API', () => {
    const id = '5d3f1c3e-1111-4222-8333-444455556666'
    const expected = { provider: 'lever', apiUrl: `https://api.lever.co/v0/postings/northwind/${id}` }
    expect(detectJobProvider(`https://jobs.lever.co/northwind/${id}`)).toEqual(expected)
    expect(detectJobProvider(`https://jobs.lever.co/northwind/${id}/apply`)).toEqual(expected)
  })
  it('falls back to generic for company sites, gh_jid links, junk and non-http(s)', () => {
    expect(detectJobProvider('https://acme.com/careers?gh_jid=123')).toEqual({ provider: 'generic' })
    expect(detectJobProvider('https://boards.greenhouse.io/acmecloud')).toEqual({ provider: 'generic' })
    expect(detectJobProvider('not a url')).toEqual({ provider: 'generic' })
    expect(detectJobProvider('ftp://boards.greenhouse.io/a/jobs/1')).toEqual({ provider: 'generic' })
    expect(detectJobProvider('javascript:alert(1)')).toEqual({ provider: 'generic' })
  })
})

describe('htmlToText', () => {
  it('converts lists/paragraphs, drops scripts/styles, decodes entities', () => {
    const t = htmlToText('<style>p{}</style><script>x()</script><h2>Title</h2><p>A &amp; B&nbsp;&#39;c&#x41;</p><ul><li>One</li><li>Two<br>three</li></ul>')
    expect(t).toBe("Title\n\nA & B 'cA\n\n- One\n- Two\nthree")
  })
  it('handles junk input', () => {
    expect(htmlToText('')).toBe('')
    expect(htmlToText('<<>>')).toBe('>')
  })
})

describe('jobFromGreenhouse', () => {
  it('unescapes the content and extracts fields', () => {
    const j = jobFromGreenhouse(GH_JOB)
    expect(j.title).toBe('Senior Frontend Engineer')
    expect(j.company).toBe('Acmecloud')
    expect(j.location).toBe('Remote - US')
    expect(j.url).toBe(GH_JOB.absolute_url)
    expect(j.description).toContain('- Build React & TypeScript interfaces')
    expect(j.description).not.toContain('<')
    expect(j.requirements.some((r) => r.skill === 'React')).toBe(true)
    expect(j.experienceYearsMin).toBe(3)
    expect(j.responsibilities.length).toBeGreaterThan(0)
  })
  it('prefers company_name when present and tolerates junk', () => {
    expect(jobFromGreenhouse({ ...GH_JOB, company_name: 'Acme Cloud' }).company).toBe('Acme Cloud')
    expect(jobFromGreenhouse(null)).toEqual({ responsibilities: [], requirements: [] })
    expect(jobFromGreenhouse({}).title).toBeUndefined()
  })
})

describe('jobFromLever', () => {
  it('builds the description from lists and maps categories', () => {
    const j = jobFromLever(LEVER_JOB)
    expect(j).toMatchObject({ title: 'Backend Engineer', company: 'Northwind', location: 'Berlin, Germany', employmentType: 'full-time', workType: 'hybrid' })
    expect(j.description).toContain('What you will do:')
    expect(j.description).toContain('- Design REST APIs')
    expect(j.requirements.some((r) => r.skill === 'Node.js')).toBe(true)
    expect(j.experienceYearsMin).toBe(2)
  })
  it('tolerates junk', () => {
    expect(jobFromLever('x')).toEqual({ responsibilities: [], requirements: [] })
    expect(jobFromLever({ text: 'Only title' }).title).toBe('Only title')
  })
})

describe('extractJobFromHtml', () => {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Data Engineer',
    hiringOrganization: { '@type': 'Organization', name: 'Globex' },
    jobLocation: { '@type': 'Place', address: { addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' } },
    employmentType: ['CONTRACTOR'],
    jobLocationType: 'TELECOMMUTE',
    baseSalary: { '@type': 'MonetaryAmount', currency: 'USD', value: { minValue: 120000, maxValue: 150000, unitText: 'YEAR' } },
    description: '<p>Build pipelines with Python and SQL.</p><ul><li>3+ years of experience with Python</li></ul>',
  }
  const page = (blocks: unknown[]) =>
    `<html><head><title>x</title>${blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('')}</head><body></body></html>`

  it('reads a JobPosting JSON-LD block', () => {
    const j = extractJobFromHtml(page([ld]), 'https://globex.com/jobs/1')!
    expect(j.provider).toBe('jsonld')
    expect(j).toMatchObject({ title: 'Data Engineer', company: 'Globex', location: 'Austin, TX, US', employmentType: 'contract', workType: 'remote', url: 'https://globex.com/jobs/1' })
    expect(j.salary).toBe('$120,000 – $150,000 / year')
    expect(j.description).toContain('- 3+ years of experience with Python')
  })
  it('finds JobPosting inside arrays and @graph', () => {
    expect(extractJobFromHtml(page([[{ '@type': 'WebSite' }, ld]]))?.title).toBe('Data Engineer')
    expect(extractJobFromHtml(page([{ '@graph': [{ '@type': 'Organization' }, ld] }]))?.provider).toBe('jsonld')
  })
  it('falls back to og/main text when long enough, else null', () => {
    const long = 'We are hiring a Platform Engineer. '.repeat(15)
    const html = `<html><head><title>Fallback title</title><meta property="og:title" content="Platform Engineer"><meta content="Initech" property="og:site_name"></head><body><nav>Menu</nav><main><p>${long}</p></main></body></html>`
    const j = extractJobFromHtml(html, 'https://initech.com/j')!
    expect(j).toMatchObject({ provider: 'html', title: 'Platform Engineer', company: 'Initech' })
    expect(j.description!.length).toBeGreaterThanOrEqual(300)
    expect(j.description).not.toContain('Menu')
    expect(extractJobFromHtml('<html><body><p>Short page</p></body></html>')).toBeNull()
  })
  it('ignores malformed JSON-LD and junk input', () => {
    expect(extractJobFromHtml('<script type="application/ld+json">{oops</script>')).toBeNull()
    expect(extractJobFromHtml('')).toBeNull()
  })
})
