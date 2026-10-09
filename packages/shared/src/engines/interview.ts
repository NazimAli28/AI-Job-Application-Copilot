import type { CandidateBundle } from '../schemas/profile'
import type { Job } from '../schemas/job'
import type { AnswerEvaluation, InterviewQuestion } from '../schemas/interview'
import { BEHAVIORAL, GENERIC_TECHNICAL, TECHNICAL, TECH_WHY } from './data/question-bank'
import { skillEvidence } from './match'
import { extractSkills, normalizeSkill, skillCategory } from './skills'

type Difficulty = 'easy' | 'medium' | 'hard'
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']
const TARGET_TOTAL = 14

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const STAR = 'STAR: Situation (brief context) → Task (your responsibility) → Action (what YOU did, step by step) → Result (the outcome; quantify only if you can back it up) → optional: what you learned.'
const TECH_STRUCTURE = 'Define the concept briefly → explain how it works and the trade-offs → give a real example from your own work → mention pitfalls or what you would do differently.'
const CAND_STRUCTURE = 'Context → your specific contribution → the outcome → what you learned or would change.'

function seniority(job: Job): Difficulty {
  const t = job.title.toLowerCase()
  if (/\b(senior|sr\.?|lead|principal|staff|head|architect|manager|director)\b/.test(t)) return 'hard'
  if (/\b(junior|jr\.?|intern|entry|graduate|trainee|associate)\b/.test(t)) return 'easy'
  const y = job.experienceYearsMin
  if (y !== undefined) return y >= 5 ? 'hard' : y <= 1 ? 'easy' : 'medium'
  return 'medium'
}

function techHint(candidate: CandidateBundle, skill: string): string[] {
  const ev = skillEvidence(candidate, skill)
  if (ev.rejected) return [`You marked ${skill} as not part of your experience — be upfront about that and focus on adjacent skills you do have.`]
  if (ev.strong.length) return [`Your profile shows ${ev.strong[0]} — prepare one concrete example of how you used ${skill}.`, 'Be ready to explain a trade-off or a mistake you made with it.']
  if (ev.partial.length) return [`You have partial evidence (${ev.partial[0]}) — be ready to explain how deeply you actually used ${skill}.`]
  return [`${skill} is not in your profile. Be honest about your level, mention adjacent skills you do have, and explain how you would ramp up.`]
}

export function buildQuestionSet(candidate: CandidateBundle, job: Job): InterviewQuestion[] {
  const diff = seniority(job)
  const di = DIFFS.indexOf(diff)
  const out: InterviewQuestion[] = []
  const exps = [...candidate.experience].sort((a, b) => Number(b.current) - Number(a.current) || b.startDate.localeCompare(a.startDate))
  const latest = exps[0]

  // ---- technical
  const jobSkills = job.requirements
    .filter((r) => r.category === 'skill')
    .sort((a, b) => Number(b.kind === 'required') - Number(a.kind === 'required'))
    .map((r) => r.skill ?? r.text)
    .filter((s) => !['soft'].includes(skillCategory(s) ?? ''))
  const uniqueSkills = [...new Set(jobSkills)].slice(0, 6)
  const techQs: InterviewQuestion[] = []
  const makeTech = (skill: string, idx: number): InterviewQuestion => {
    const tpl = TECHNICAL[skill] ?? GENERIC_TECHNICAL.map((q) => q.replace(/\{skill\}/g, skill))
    return {
      id: `q-tech-${slug(skill)}-${idx}`,
      type: 'technical',
      question: tpl[idx]!,
      why: `${TECH_WHY} The job lists ${skill}.`,
      answerStructure: TECH_STRUCTURE,
      hints: techHint(candidate, skill),
      skill,
      difficulty: DIFFS[idx]!,
    }
  }
  for (const s of uniqueSkills) techQs.push(makeTech(s, di))
  if (uniqueSkills.length < 4) for (const s of uniqueSkills.slice(0, 4 - uniqueSkills.length)) techQs.push(makeTech(s, di === 2 ? 1 : di + 1 > 2 ? 2 : di + 1))

  // ---- candidate-specific
  const cand: InterviewQuestion[] = []
  const mk = (n: number, question: string, why: string, hints: string[]): InterviewQuestion => ({ id: `q-cand-${n}`, type: 'candidate', question, why, answerStructure: CAND_STRUCTURE, hints })
  if (latest) {
    cand.push(mk(1, `You were ${latest.title} at ${latest.company} — what was your biggest impact there?`, 'Interviewers probe the experience on your resume to verify depth and to see how you define impact.', [`Pick one achievement from your time at ${latest.company} and describe your own contribution.`, ...(latest.bullets[0] ? [`Your resume says: "${latest.bullets[0]}" — be ready to expand on it.`] : [])]))
  }
  for (const p of candidate.projects.slice(0, 2)) {
    cand.push(mk(cand.length + 1, `Walk me through ${p.name}. What problem did it solve and what would you do differently?`, 'Projects show initiative, technical depth and how you reflect on your own work.', [`Technologies you list: ${p.technologies.slice(0, 5).join(', ') || 'none listed — be ready to name the stack'}.`, 'Prepare one decision you made and its trade-offs.']))
  }
  const learning = candidate.skills.find((s) => s.status === 'learning' && jobSkills.some((j) => normalizeSkill(j) === normalizeSkill(s.name)))
  if (learning) cand.push(mk(cand.length + 1, `Your profile shows you are still learning ${learning.name}. How are you learning it, and how quickly could you be productive with it?`, 'Interviewers explore skill gaps honestly to see self-awareness and learning ability.', ['Describe concrete steps you have already taken (course, project, practice).', 'Do not overstate your level.']))
  const second = exps.find((e, i) => i > 0 && e.bullets.length)
  if (second && cand.length < 3) cand.push(mk(cand.length + 1, `At ${second.company} your resume says: "${second.bullets[0]}". What was your role and what was the outcome?`, 'Checks that you can discuss older experience in detail.', ['Be specific about what you personally did versus the team.']))
  const candQs = cand.slice(0, 3)

  // ---- behavioral
  const behCount = Math.max(5, TARGET_TOTAL - techQs.length - candQs.length)
  const top = jobSkills[0]
  const yrs = candidate.profile?.yearsExperience
  const strongSkills = candidate.skills.filter((s) => s.status === 'confirmed').map((s) => s.name).slice(0, 3)
  const beh: InterviewQuestion[] = BEHAVIORAL.slice(0, behCount).map((b, i) => {
    let q = b.q
    let structure = STAR
    let hints: string[]
    if (i === 0) {
      structure = 'Present → Past → Future: what you do now, the experience that got you here, and why this role is the next step.'
      hints = [
        ...(latest ? [`Open with your current/most recent role: ${latest.title} at ${latest.company}.`] : ['Open with the work or study you are doing now.']),
        ...(yrs ? [`You can mention ${yrs} year${yrs === 1 ? '' : 's'} of experience.`] : []),
        ...(strongSkills.length ? [`Weave in skills you have confirmed: ${strongSkills.join(', ')}.`] : []),
        'Keep it to about 60–90 seconds.',
      ]
    } else if (i === 1) {
      structure = 'What attracts you to the role → experience of yours that matches → what you want to contribute or learn.'
      hints = [top ? `Connect the job's emphasis on ${top} to something you have really done.` : 'Connect a specific requirement of the job to something you have really done.', 'Mention only what you genuinely find interesting about the work.']
    } else if (i === 2) {
      q = `Why do you want to work at ${job.company}?`
      structure = 'Something specific you learned about the company → how it connects to your goals or experience → what you hope to contribute.'
      hints = [`Research ${job.company}'s product, mission and recent news, and mention only what you verify yourself.`, 'Avoid generic praise; be specific.']
    } else {
      hints = [latest ? `Look for a situation from your time as ${latest.title} at ${latest.company}.` : 'Choose a real situation from work, study or a project.', 'Focus on your own actions and a real result.']
    }
    return { id: `q-beh-${i + 1}`, type: 'behavioral', question: q, why: b.why, answerStructure: structure, hints }
  })

  out.push(...beh.slice(0, 3), ...techQs, ...candQs, ...beh.slice(3))
  return out
}

// ---------------------------------------------------------------- evaluation
const STOP = new Set(['what', 'when', 'where', 'which', 'with', 'that', 'this', 'there', 'about', 'tell', 'have', 'your', 'from', 'would', 'could', 'should', 'time', 'describe', 'give', 'example', 'does', 'they', 'them', 'their', 'work', 'role', 'explain', 'how', 'why', 'you', 'the', 'and', 'for', 'are', 'was', 'were', 'will'])
const FILLERS = /\b(um+|uh+|like|you know|basically|actually|kind of|sort of|literally|stuff|things|i guess|i think maybe)\b/gi
const TECH_VOCAB = /\b(performance|scal\w+|cache|caching|test\w*|state|async\w*|index\w*|quer(?:y|ies)|latency|throughput|memory|thread\w*|concurren\w+|api|database|schema|deploy\w*|pipeline|container\w*|security|auth\w*|encrypt\w*|trade-?offs?|complexity|abstraction|interface|dependency|module|component|render\w*|bundle|protocol|request|response|transaction|consisten\w+|availability|monitor\w*|logging|refactor\w*|architecture|reliab\w+)\b/gi
const STAR_MARKERS = {
  situation: /\b(situation|context|background|at the time|when i was|we were|our team|the project|the company)\b/i,
  task: /\b(task|goal|objective|responsible for|needed to|had to|asked to|challenge|my job was)\b/i,
  action: /\b(i (?:built|implemented|led|decided|created|wrote|designed|developed|analy[sz]ed|organi[sz]ed|proposed|set up|started|worked|talked|reached out|introduced|refactored|fixed|investigated)|i took|my approach|so i)\b/i,
  result: /\b(result|outcome|as a result|which (?:led|reduced|improved|increased|saved)|ended up|improved|reduced|increased|achieved|delivered|shipped|saved|learned)\b/i,
}
const SEQUENCE = /\b(first(?:ly)?|second(?:ly)?|then|next|after that|finally|lastly|because|therefore|so that|in contrast|however)\b/gi

const clamp15 = (n: number) => Math.max(1, Math.min(5, Math.round(n)))
const wordsOf = (s: string) => s.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []

export function evaluateAnswer(question: InterviewQuestion, answer: string): AnswerEvaluation {
  const text = answer.trim()
  const words = text ? text.split(/\s+/).length : 0
  const tokens = wordsOf(text)
  const tooShort = words < 15
  const veryShort = words < 8
  const cap = (n: number, max: number) => (tooShort ? Math.min(n, max) : n)

  // relevance
  const kw = new Set<string>()
  for (const w of wordsOf(`${question.question} ${question.skill ?? ''}`)) if (w.length >= 4 && !STOP.has(w)) kw.add(w.slice(0, 5))
  const answerStems = new Set(tokens.map((w) => w.slice(0, 5)))
  const hits = [...kw].filter((k) => answerStems.has(k)).length
  const ratio = kw.size ? hits / Math.min(kw.size, 6) : 0.3
  let relevance = ratio >= 0.5 ? 5 : ratio >= 0.35 ? 4 : ratio >= 0.2 ? 3 : ratio >= 0.1 ? 2 : 1
  if (question.type !== 'technical' && relevance < 3 && words >= 60) relevance = 3 // behavioral answers often paraphrase
  relevance = cap(relevance, 2)

  // clarity
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim())
  const avgLen = sentences.length ? words / sentences.length : 0
  const fillers = (text.match(FILLERS) ?? []).length
  const fillerRate = words ? fillers / words : 0
  let clarity = 5
  if (avgLen > 40) clarity -= 2
  else if (avgLen > 28) clarity -= 1
  if (fillerRate > 0.06) clarity -= 2
  else if (fillerRate > 0.03) clarity -= 1
  clarity = cap(clamp15(clarity), 2)

  // technical accuracy
  let technicalAccuracy = 3
  if (question.type === 'technical') {
    const found = extractSkills(text)
    const target = question.skill ? (normalizeSkill(question.skill) ?? question.skill) : null
    const skillMention = target ? found.includes(target) || text.toLowerCase().includes(target.toLowerCase()) : false
    const vocab = new Set((text.match(TECH_VOCAB) ?? []).map((v) => v.toLowerCase())).size
    const extra = found.filter((f) => f !== target).length
    technicalAccuracy = clamp15(1 + (skillMention ? 1 : 0) + Math.min(2, Math.floor(vocab / 2)) + (extra ? 1 : 0))
    technicalAccuracy = cap(technicalAccuracy, 2)
  }

  // structure
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length
  const seq = (text.match(SEQUENCE) ?? []).length
  const hasExample = /\b(for example|for instance|e\.g\.|such as)\b/i.test(text)
  let structure: number
  if (question.type === 'technical') {
    structure = 1 + Math.min(4, Math.min(2, seq) + (hasExample ? 1 : 0) + (paragraphs > 1 ? 1 : 0))
  } else {
    const present = (Object.keys(STAR_MARKERS) as (keyof typeof STAR_MARKERS)[]).filter((k) => STAR_MARKERS[k].test(text))
    structure = 1 + present.length
    if (present.length < 4 && (seq >= 2 || paragraphs > 1)) structure += 1
  }
  structure = cap(clamp15(structure), 2)
  const starMissing = (Object.keys(STAR_MARKERS) as (keyof typeof STAR_MARKERS)[]).filter((k) => !STAR_MARKERS[k].test(text))

  // examples
  const numbers = (text.match(/\d+(?:\.\d+)?%?/g) ?? []).length
  const toolCount = extractSkills(text).length
  const iAction = /\bi (?:built|implemented|led|created|wrote|designed|developed|migrated|shipped|fixed|launched|reduced|improved|automated)\b|\bwe shipped\b/i.test(text)
  const examples = cap(clamp15(1 + (numbers ? 1 : 0) + (hasExample ? 1 : 0) + (iAction ? 1 : 0) + (toolCount >= 1 ? 1 : 0)), 2)

  // conciseness
  let conciseness: number
  if (words < 20) conciseness = 1
  else if (words < 50) conciseness = 2
  else if (words < 80) conciseness = 3
  else if (words <= 300) conciseness = words >= 100 && words <= 250 ? 5 : 4
  else if (words <= 400) conciseness = 3
  else conciseness = 2

  const criteria = { relevance, clarity, technicalAccuracy, structure, examples, conciseness }
  const avg = Object.values(criteria).reduce((a, b) => a + b, 0) / 6
  const score = Math.round(avg * 20)

  const strengths: string[] = []
  const weaknesses: string[] = []
  const suggestions: string[] = []
  if (!text) {
    weaknesses.push('No answer was provided.')
    suggestions.push('Write 80–300 words: start with a direct answer, then support it with a specific example.')
  } else {
    if (relevance >= 4) strengths.push('Your answer stays on topic and uses the key terms from the question.')
    if (clarity >= 4) strengths.push('Sentences are clear and easy to follow.')
    if (question.type === 'technical' && technicalAccuracy >= 4) strengths.push('You used relevant technical terms and concepts.')
    if (structure >= 4) strengths.push(question.type === 'technical' ? 'Your explanation is organized with clear steps.' : 'Your answer follows a clear situation-action-result flow.')
    if (examples >= 4) strengths.push('You backed your answer with specifics (tools, numbers or concrete actions).')
    if (conciseness >= 4) strengths.push('The length is in a good range (about 80–300 words).')
    if (relevance <= 2) { weaknesses.push('The answer does not clearly address the question asked.'); suggestions.push('Restate the question in your first sentence and answer it directly before adding detail.') }
    if (clarity <= 3) { weaknesses.push(fillerRate > 0.03 ? 'Several filler words make the answer less crisp.' : 'Some sentences are very long.'); suggestions.push(fillerRate > 0.03 ? 'Cut fillers such as "like", "basically" and "you know"; pause instead.' : 'Break long sentences into shorter ones (aim for under 25 words each).') }
    if (question.type === 'technical' && technicalAccuracy <= 2) { weaknesses.push('Few technical details or concepts were mentioned.'); suggestions.push(`Name the key concepts${question.skill ? ` of ${question.skill}` : ''} and explain how they work and their trade-offs.`) }
    if (structure <= 3) {
      weaknesses.push(question.type === 'technical' ? 'The explanation lacks a clear order.' : `The answer is missing parts of the STAR structure (${starMissing.join(', ') || 'order'}).`)
      suggestions.push(question.type === 'technical' ? 'Use an order such as: definition, how it works, example, pitfalls.' : `Add the missing STAR element${starMissing.length === 1 ? '' : 's'}: ${starMissing.join(', ')}.`)
    }
    if (examples <= 3) { weaknesses.push('Few concrete examples or details.'); suggestions.push('Add a specific example: what you built or did, which tools you used, and the result. Include a number only if it is real.') }
    if (words < 80) { weaknesses.push(`The answer is short (${words} words).`); suggestions.push('Expand to roughly 80–300 words with context, your actions and the outcome.') }
    else if (words > 300) { weaknesses.push(`The answer is long (${words} words).`); suggestions.push('Tighten the answer to under 300 words; lead with the main point.') }
    if (veryShort) suggestions.push('Try writing a full answer before submitting so the feedback is more useful.')
    if (!strengths.length) strengths.push('You made a start; adding structure and specifics will lift the score quickly.')
  }

  return { score, criteria, strengths, weaknesses, suggestions, source: 'rules' }
}
