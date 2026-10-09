import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Briefcase, KanbanSquare, List, Plus, Search } from 'lucide-react'
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddJobDialog } from './add-job'
import { useJobs } from './api'
import { JobTable } from './board/job-table'
import { KanbanBoard } from './board/kanban'
import { selectClass } from './list-editors'

type View = 'board' | 'list'

export function JobsPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'list' ? 'list' : 'board'
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [needsDesc, setNeedsDesc] = useState(false)
  const [archived, setArchived] = useState(false)
  const { data, isPending, error, refetch } = useJobs(archived)

  // "+ Add job" deep link (?add=1): open the dialog once, then clean the URL.
  useEffect(() => {
    if (params.get('add') !== '1') return
    setAdding(true)
    const next = new URLSearchParams(params)
    next.delete('add')
    setParams(next, { replace: true })
  }, [params, setParams])

  const setView = (v: string) => {
    const next = new URLSearchParams(params)
    if (v === 'list') next.set('view', 'list')
    else next.delete('view')
    setParams(next, { replace: true })
  }

  const tags = useMemo(() => [...new Set((data ?? []).flatMap((j) => j.tags))].sort(), [data])
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? [])
      .filter((j) => !tag || j.tags.includes(tag))
      .filter((j) => !needsDesc || j.needsDescription)
      .filter((j) => !term || `${j.title} ${j.company} ${j.tags.join(' ')}`.toLowerCase().includes(term))
  }, [data, q, tag, needsDesc])

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus /> Add job
    </Button>
  )
  const filtered = !!(q || tag || needsDesc)

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Save jobs you're interested in and track them all the way to an offer."
        actions={addButton}
      />
      {isPending ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.length === 0 && !archived ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Save jobs you're interested in, then track them all the way to an offer."
          action={addButton}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs value={view} onValueChange={setView}>
              <TabsList>
                <TabsTrigger value="board">
                  <KanbanSquare /> Board
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List /> List
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search jobs"
                placeholder="Search title, company, tags"
                className="pl-8"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {tags.length > 0 && (
                <select
                  aria-label="Filter by tag"
                  className={`${selectClass} w-36`}
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">All tags</option>
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
              <Label className="gap-2 font-normal">
                <Switch checked={needsDesc} onCheckedChange={setNeedsDesc} /> Needs description
              </Label>
              <Label className="gap-2 font-normal">
                <Switch checked={archived} onCheckedChange={setArchived} /> Show archived
              </Label>
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title={filtered ? 'No jobs match' : 'Nothing here yet'}
              description={filtered ? 'Try clearing a filter or search.' : 'Add a job to get started.'}
            />
          ) : view === 'board' ? (
            <KanbanBoard jobs={rows} />
          ) : (
            <JobTable jobs={rows} />
          )}
        </>
      )}
      <AddJobDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
