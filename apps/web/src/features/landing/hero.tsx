import { Link, useNavigate } from 'react-router'
import { ArrowRight, Check, Minus, X } from 'lucide-react'
import { ScoreRing } from '@/components/common/score'
import { Spinner } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDemoLogin } from '@/features/auth/api'

export function DemoButton({ size = 'lg' }: { size?: 'lg' | 'default' }) {
  const navigate = useNavigate()
  const demo = useDemoLogin()
  return (
    <Button
      size={size}
      variant="outline"
      disabled={demo.isPending}
      onClick={() => demo.mutate(undefined, { onSuccess: () => navigate('/app/dashboard') })}
    >
      {demo.isPending && <Spinner />} Try the live demo
    </Button>
  )
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
      <div>
        <Badge variant="secondary" className="mb-4">
          Free, rule-based core · AI Pro in invite-only beta
        </Badge>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Understand your fit. Build better applications. Prepare smarter. Track everything.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Paste a job description and see how your real experience lines up: strong skills, gaps and what to improve,
          without ever inventing experience you don&apos;t have.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link to="/register">
              Get started free <ArrowRight />
            </Link>
          </Button>
          <DemoButton />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">No credit card. The demo is read-only and needs no sign-up.</p>
      </div>
      <ProductPreview />
    </section>
  )
}

const SKILLS = [
  { name: 'React', status: 'strong' },
  { name: 'TypeScript', status: 'strong' },
  { name: 'Node.js', status: 'partial' },
  { name: 'GraphQL', status: 'partial' },
  { name: 'Kubernetes', status: 'missing' },
] as const

const STATUS = {
  strong: { icon: Check, cls: 'text-success', label: 'Strong' },
  partial: { icon: Minus, cls: 'text-warning', label: 'Partial' },
  missing: { icon: X, cls: 'text-destructive', label: 'Missing' },
}

/** Illustrative sample only: not real candidate data. */
function ProductPreview() {
  return (
    <div className="relative" aria-label="Product preview (sample data)" role="img">
      <div className="rounded-2xl border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-4">
          <ScoreRing score={78} size={88} label="fit" />
          <div>
            <p className="text-xs text-muted-foreground">Sample job</p>
            <p className="font-heading font-semibold">Frontend Engineer</p>
            <p className="text-xs text-muted-foreground">Estimated fit: a guide, not a prediction</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2">
          {SKILLS.map((s) => {
            const m = STATUS[s.status]
            return (
              <li key={s.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className={`flex items-center gap-1 text-xs ${m.cls}`}>
                  <m.icon className="size-3.5" /> {m.label}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Next step:</span> add real evidence for Node.js to your
          profile, then re-run the match.
        </div>
      </div>
    </div>
  )
}
