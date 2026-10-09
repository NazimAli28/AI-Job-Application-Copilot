import { SourceBadge } from '@/components/common/ai'

/** Static example shown (blurred) to users without AI Pro. Sample data only. */
export function AiMatchPreview() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">AI fit explanation</h3>
        <SourceBadge source="ai" />
        <span className="text-xs text-muted-foreground">Example</span>
      </div>
      <p className="text-sm">
        Estimated fit for Frontend Engineer at Northwind is 72/100, based only on skills and experience documented in
        your profile and resume. Your clearest strengths are React and TypeScript, each backed by evidence you
        provided. The main risk is GraphQL, which the posting lists as required.
      </p>
      <div>
        <p className="text-sm font-medium">Prioritized learning plan</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>GraphQL (required): complete a short hands-on project and add it to your profile as evidence.</li>
          <li>Testing (preferred): strengthen related experience with a concrete project or bullet.</li>
          <li>CI/CD (preferred): document any pipeline work you have already done.</li>
        </ol>
      </div>
    </div>
  )
}
