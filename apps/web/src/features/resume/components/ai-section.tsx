import { Sparkles } from 'lucide-react'
import type { Resume } from '@copilot/shared'
import { AiFeature } from '@/components/common/ai'
import { GeneratingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAiResumeAnalysis } from '../api'
import { ResumeAiPreview } from '../ai-preview'
import { AnalysisView } from './analysis-view'

/** AI Pro deep review: gated for free users, editable/approvable output for AI users. */
export function AiSection({ resume }: { resume: Resume }) {
  const run = useAiResumeAnalysis()
  return (
    <AiFeature
      title="AI resume review"
      description="Rewrites weak bullets and gives section-level feedback, without inventing facts."
      preview={<ResumeAiPreview />}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI resume review
          </CardTitle>
          <CardDescription>
            Suggestions are never applied automatically. Copy what you like and replace placeholders
            with real details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {run.isPending ? (
            <GeneratingState
              label="Reviewing your resume…"
              steps={['Reading each bullet', 'Drafting rewrites', 'Checking nothing is invented']}
            />
          ) : (
            <>
              <Button onClick={() => run.mutate(resume.id)}>
                <Sparkles /> {resume.aiAnalysis ? 'Run again' : 'Run AI analysis'}
              </Button>
              {resume.aiAnalysis && <AnalysisView analysis={resume.aiAnalysis} />}
            </>
          )}
        </CardContent>
      </Card>
    </AiFeature>
  )
}
