import { Link } from 'react-router'
import {
  BarChart3,
  Check,
  EyeOff,
  FileSearch,
  FileText,
  Gauge,
  KanbanSquare,
  MessagesSquare,
  PenLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DemoButton } from './hero'

const STEPS = [
  ['Build your profile', 'Upload a resume or enter your experience once. You confirm every skill.'],
  ['Add a job', 'Paste a job description. Requirements are parsed and you can edit them.'],
  ['See your fit', 'Get an estimated fit score with strong, partial and missing skills.'],
  ['Apply and prepare', 'Tailor your resume, draft a cover letter, practice interview questions, track it all.'],
]

const FEATURES = [
  [FileSearch, 'Resume analysis & fixes', 'Spot weak bullets, missing sections and ATS issues with concrete fixes.'],
  [Gauge, 'Job match & skill gaps', 'See exactly which requirements you cover and where to grow.'],
  [SlidersHorizontal, 'Resume tailoring', 'Suggestions that reorder and rephrase your real experience for each job.'],
  [PenLine, 'Cover letters', 'Drafts built from your actual background, always editable.'],
  [MessagesSquare, 'Interview coach', 'Role-specific questions, mock interviews and feedback on every answer.'],
  [KanbanSquare, 'Application tracker', 'A kanban board with notes, dates and follow-ups.'],
  [BarChart3, 'Analytics', 'Understand your pipeline: response rates, stages and trends.'],
] as const

const PRINCIPLES = [
  [ShieldCheck, 'Never fabricates experience', 'Suggestions only reuse facts from your profile. Gaps are shown, not hidden.'],
  [SlidersHorizontal, 'You stay in control', 'Nothing is applied automatically. Every suggestion is yours to accept or edit.'],
  [EyeOff, 'Private by design', 'Your data is yours: export it any time. Rule-based features never leave your device.'],
] as const

const FAQ = [
  ['Is it really free?', 'Yes. The rule-based core (analysis, matching, tailoring, tracker, interview prep) is free and unlimited.'],
  ['What is AI Pro?', 'An invite-only beta that adds Claude-powered versions of key features. Request access from Settings.'],
  ['Will it invent skills for my resume?', 'No. It only works with what is in your profile, and flags gaps instead of papering over them.'],
  ['What does the fit score mean?', 'It is an estimated fit between your profile and a job description, a guide to prioritize, not a hiring prediction.'],
  ['Can I try it without signing up?', 'Yes. The live demo is a read-only account with sample data.'],
]

export function HowItWorks() {
  return (
    <section id="how" className="border-y bg-muted/30 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-xl border bg-card p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="mt-3 font-medium">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="font-heading text-3xl font-semibold tracking-tight">Everything for one job search</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, t, d]) => (
          <div key={t} className="rounded-xl border bg-card p-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-3 font-medium">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
        <div className="flex flex-col justify-center rounded-xl border border-dashed p-5">
          <FileText className="size-5 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">One profile feeds every tool, so you never retype your history.</p>
        </div>
      </div>
    </section>
  )
}

const ROWS = [
  ['Resume analysis, job match, tailoring', true, true],
  ['Cover letters & interview prep', true, true],
  ['Application tracker & analytics', true, true],
  ['Claude-powered rewrites & feedback', false, true],
  ['Candidate-specific interview questions', false, true],
] as const

export function Pricing() {
  return (
    <section id="pricing" className="border-y bg-muted/30 py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">Free vs AI Pro</h2>
        <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-4 font-medium">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="p-4">
                  <p className="font-heading font-semibold">Free</p>
                  <p className="text-xs font-normal text-muted-foreground">$0 · rule-based · unlimited</p>
                </th>
                <th className="p-4">
                  <p className="flex items-center gap-1 font-heading font-semibold text-primary">
                    <Sparkles className="size-4" /> AI Pro
                  </p>
                  <p className="text-xs font-normal text-muted-foreground">Invite-only beta · Claude-powered</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, free, pro]) => (
                <tr key={label} className="border-b last:border-0">
                  <td className="p-4">{label}</td>
                  {[free, pro].map((v, i) => (
                    <td key={i} className="p-4">
                      {v ? <Check className="size-4 text-success" aria-label="Included" /> : <span className="text-muted-foreground" aria-label="Not included">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function Principles() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="font-heading text-3xl font-semibold tracking-tight">Built on trust</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PRINCIPLES.map(([Icon, t, d]) => (
          <div key={t} className="rounded-xl border bg-card p-5">
            <Icon className="size-6 text-primary" />
            <h3 className="mt-3 font-medium">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <h2 className="font-heading text-3xl font-semibold tracking-tight">FAQ</h2>
      <div className="mt-6 divide-y rounded-xl border bg-card">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="cursor-pointer font-medium">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
      <div className="mt-12 rounded-2xl bg-primary/5 p-8 text-center">
        <h2 className="font-heading text-2xl font-semibold">Ready to apply smarter?</h2>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link to="/register">Get started free</Link>
          </Button>
          <DemoButton />
        </div>
      </div>
    </section>
  )
}
