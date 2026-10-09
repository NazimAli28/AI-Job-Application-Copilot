import { Sparkles } from 'lucide-react'
import { AiFeature, SourceBadge } from '@/components/common/ai'
import { GeneratingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/features/jobs/assistant/copy-button'
import { useAnalysisAi } from './api'

/** Static example shown (blurred) to users without AI Pro. Sample data only. */
function Preview() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">AI deep analysis</h3>
        <SourceBadge source="ai" />
        <span className="text-xs text-muted-foreground">Example</span>
      </div>
      <p className="text-sm">
        Your React and TypeScript work lines up well with this role. The main risk is GraphQL, which the posting
        lists as required. A short project using it would give you concrete evidence to add to your resume.
      </p>
      <div className="rounded-lg border p-3 text-sm">
        <p className="text-xs text-muted-foreground">Experience</p>
        <p className="mt-1 text-muted-foreground line-through">Worked on the checkout page.</p>
        <p className="mt-1 font-medium">Rebuilt the checkout page in React and TypeScript, improving maintainability.</p>
      </div>
    </div>
  )
}

export function AiTab({ id }: { id: string }) {
  const ai = useAnalysisAi(id)
  return (
    <AiFeature
      title="AI deep analysis"
      description="A natural-language explanation of your fit and AI-rewritten resume bullets for this job."
      preview={<Preview />}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            AI deep analysis <SourceBadge source="ai" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          {ai.isPending ? (
            <GeneratingState label="Running the AI analysis…" />
          ) : ai.data ? (
            <>
              <p className="text-sm">{ai.data.match.explanation}</p>
              {ai.data.match.recommendations.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {ai.data.match.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              {ai.data.tailoring.bulletSuggestions.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    AI bullet suggestions <SourceBadge source="ai" />
                  </p>
                  <ul className="grid grid-cols-1 gap-2">
                    {ai.data.tailoring.bulletSuggestions.map((b) => (
                      <li key={b.id} className="rounded-lg border p-3 text-sm">
                        <p className="text-muted-foreground line-through">{b.original}</p>
                        <p className="mt-1 font-medium">{b.suggested}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{b.reason}</p>
                        <div className="mt-2">
                          <CopyButton text={b.suggested} label="Copy suggestion" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">AI output is a suggestion. Review and edit it before using it.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a richer explanation and AI-written bullet suggestions based on the same evidence.
            </p>
          )}
          <Button className="w-fit" variant={ai.data ? 'outline' : 'default'} disabled={ai.isPending} onClick={() => ai.mutate()}>
            <Sparkles /> {ai.data ? 'Regenerate' : 'Run AI deep analysis'}
          </Button>
        </CardContent>
      </Card>
    </AiFeature>
  )
}
