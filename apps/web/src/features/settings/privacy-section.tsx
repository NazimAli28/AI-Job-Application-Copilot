import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { collectExport } from './api'

export function PrivacySection() {
  const [busy, setBusy] = useState(false)

  async function exportData() {
    setBusy(true)
    try {
      const data = await collectExport()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'job-copilot-export.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data &amp; privacy</CardTitle>
        <CardDescription>You own your data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Stored: your profile, resumes, saved jobs, applications and interview practice.</li>
          <li>Rule-based features run without sending your data to any AI provider.</li>
          <li>AI Pro features send only the text needed for that request, and only when you click them.</li>
          <li>In this prototype everything is kept in your browser&apos;s local storage.</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData} disabled={busy}>
            {busy ? <Spinner /> : <Download />} Export my data
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="destructive" disabled className="pointer-events-none">
                  <Trash2 /> Delete account
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Available when the backend launches</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  )
}
