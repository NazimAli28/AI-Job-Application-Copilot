import { Database, Lightbulb, Sparkles } from 'lucide-react'
import type { AnalyticsData } from '@copilot/shared'
import { AiFeature, SourceBadge } from '@/components/common/ai'
import { GeneratingState } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AiInsightsPreview } from './ai-preview'
import { useAiInsights } from './api'

type Insight = AnalyticsData['insights'][number]

function InsightList({ items }: { items: Insight[] }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.text} className="flex gap-3 rounded-lg border p-3 text-sm">
          {i.kind === 'fact' ? (
            <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          )}
          <div className="min-w-0">
            <Badge variant={i.kind === 'fact' ? 'secondary' : 'outline'} className="mb-1">
              {i.kind === 'fact' ? 'Fact from your data' : 'Suggestion'}
            </Badge>
            <p>{i.text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AiInsights() {
  const gen = useAiInsights()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          AI insights <SourceBadge source="ai" />
        </p>
        <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
          <Sparkles /> {gen.data ? 'Regenerate' : 'Generate AI insights'}
        </Button>
      </div>
      {gen.isPending && <GeneratingState label="Reading your numbers…" />}
      {gen.data?.message && (
        <Alert>
          <AlertDescription>{gen.data.message}</AlertDescription>
        </Alert>
      )}
      {gen.data && gen.data.insights.length > 0 && (
        <>
          <InsightList items={gen.data.insights} />
          <p className="text-xs text-muted-foreground">
            Facts quote your own numbers. Suggestions are ideas, not predictions — review before acting.
          </p>
        </>
      )}
    </div>
  )
}

export function InsightsSection({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights</CardTitle>
        <CardDescription>From your data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add more applications to see data-based insights.</p>
        ) : (
          <InsightList items={insights} />
        )}
        <AiFeature
          title="AI insights"
          description="Turn your numbers into labelled facts and suggestions."
          preview={<AiInsightsPreview />}
        >
          <AiInsights />
        </AiFeature>
      </CardContent>
    </Card>
  )
}
