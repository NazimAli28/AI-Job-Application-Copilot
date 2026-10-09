/** Static, fictional example shown to free users (not tied to any real account). */
export function TailorAiPreview() {
  return (
    <div className="space-y-3 p-4">
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">Software Engineer @ Example Co</p>
        <p className="rounded-md bg-muted/50 px-2 py-1.5 text-sm text-muted-foreground line-through">
          Worked on the checkout page and fixed bugs
        </p>
        <p className="rounded-md bg-success/10 px-2 py-1.5 text-sm">
          Maintained the checkout page and resolved defects reported by customers [add metric]
        </p>
        <p className="text-xs text-muted-foreground">
          Why: leads with the action and mirrors the job&apos;s wording, using only what your bullet already says.
        </p>
      </div>
      <div className="rounded-lg border p-3 text-sm">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Tailored summary</p>
        Frontend developer with 3 years of experience, working hands-on with React and TypeScript, applying for the
        Frontend Engineer role at Sample Inc.
      </div>
    </div>
  )
}
