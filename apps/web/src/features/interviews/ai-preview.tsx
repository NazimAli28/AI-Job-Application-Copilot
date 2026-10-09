/** Static example of AI Pro candidate-specific questions (generic sample — no real candidate data). */
export function AiQuestionsPreview() {
  const samples = [
    {
      q: 'At your most recent employer you led a migration. Which part best prepares you for this role?',
      hints: ['Draw on the measurable result you listed on your resume', 'Mention the tools you used hands-on'],
    },
    {
      q: 'Walk me through your most complex project. What trade-off would you make differently today?',
      hints: ['Be clear about what you personally built', 'Name one honest trade-off or regret'],
    },
    {
      q: 'Your profile lists a skill the job requires. Describe a time you relied on it under real constraints.',
      hints: ['Use your own evidence rather than a keyword', 'Finish with the outcome'],
    },
  ]
  return (
    <div className="space-y-3 p-4">
      {samples.map((s) => (
        <div key={s.q} className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-primary">Candidate-specific</p>
          <p className="mt-1 font-medium">{s.q}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {s.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
