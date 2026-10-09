import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardPaste, Link2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type { JobInput } from '@copilot/shared'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCreateJob } from '../api'
import { withStatus } from './helpers'
import { LinkTab } from './link-tab'
import { PasteTab } from './paste-tab'
import { QuickForm } from './quick-form'
import { StartStatus } from './start-status'

type Mode = 'paste' | 'link' | 'quick'

export function AddJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const create = useCreateJob()
  const [mode, setMode] = useState<Mode>('paste')
  const [quickApplied, setQuickApplied] = useState(false)

  function save(v: JobInput, stay = false) {
    create.mutate(v, {
      onSuccess: (job) => {
        onOpenChange(false)
        if (stay) {
          toast.success(`Saved ${job.title}`, {
            action: { label: 'Open', onClick: () => navigate(`/app/jobs/${job.id}`) },
          })
        } else {
          toast.success('Job saved')
          navigate(`/app/jobs/${job.id}`)
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>Paste a posting, import from a link, or just save the basics.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="max-w-full">
            <TabsTrigger value="paste">
              <ClipboardPaste /> Paste text
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 /> From a link
            </TabsTrigger>
            <TabsTrigger value="quick">
              <Zap /> Quick save
            </TabsTrigger>
          </TabsList>
          <TabsContent value="paste">
            <PasteTab pending={create.isPending} onSave={(v) => save(v)} />
          </TabsContent>
          <TabsContent value="link">
            <LinkTab pending={create.isPending} onSave={(v) => save(v)} />
          </TabsContent>
          <TabsContent value="quick" className="grid grid-cols-1 gap-4">
            <StartStatus applied={quickApplied} onChange={setQuickApplied} id="quick-applied" />
            <QuickForm
              mode="quick"
              submitLabel="Save job"
              pending={create.isPending}
              onSubmit={(v) => save(withStatus(v, quickApplied), true)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
