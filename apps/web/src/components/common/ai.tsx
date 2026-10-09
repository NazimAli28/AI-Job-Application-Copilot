import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Cpu, Lock, Sparkles } from 'lucide-react'
import type { Source } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/api'
import { cn } from '@/lib/utils'

/** Labels where a result came from — users should always know what is AI vs rules. */
export function SourceBadge({ source, className }: { source: Source; className?: string }) {
  return source === 'ai' ? (
    <Badge className={cn('gap-1 bg-primary/10 text-primary hover:bg-primary/10', className)}>
      <Sparkles className="size-3" /> AI Pro
    </Badge>
  ) : (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <Cpu className="size-3" /> Rule-based
    </Badge>
  )
}

export function useHasAi() {
  const { data } = useMe()
  return !!data?.aiAccess
}

/**
 * Wraps an AI Pro feature. Users with access see `children`.
 * Everyone else sees a blurred real example (`preview`) + how to get access — so free users
 * can still see what the AI does (product requirement).
 */
export function AiFeature({
  title,
  description,
  preview,
  children,
  className,
}: {
  title: string
  description: string
  preview: ReactNode
  children: ReactNode
  className?: string
}) {
  const hasAi = useHasAi()
  if (hasAi) return <>{children}</>
  return (
    <div className={cn('relative overflow-hidden rounded-xl border', className)}>
      <div className="pointer-events-none max-h-80 overflow-hidden opacity-60 blur-[2px] select-none" aria-hidden>
        {preview}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-background/85 to-background/30 p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <p className="font-medium">
            {title} <Badge className="ml-1 bg-primary/10 text-primary">AI Pro</Badge>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Above is a real example. AI Pro is invite-only while in beta.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/app/settings#ai-access">
              <Sparkles /> Request AI access
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
