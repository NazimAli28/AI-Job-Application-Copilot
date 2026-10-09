import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { KANBAN_COLUMNS, type ApplicationStatus } from '@copilot/shared'
import { cn } from '@/lib/utils'
import { useChangeJobStatus, type JobListItem } from '../api'
import { CardBody } from './job-card'

type Column = (typeof KANBAN_COLUMNS)[number]
type Move = (id: string, s: ApplicationStatus) => void

function DraggableCard({ job, onMove }: { job: JobListItem; onMove: Move }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: job.id })
  return (
    <li ref={setNodeRef} className={cn(isDragging && 'opacity-40')}>
      <CardBody
        job={job}
        onMove={(s) => onMove(job.id, s)}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Drag ${job.title} card. Press space to pick up, arrow keys to move, space to drop.`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  )
}

function KanbanColumn({ col, jobs, onMove }: { col: Column; jobs: JobListItem[]; onMove: Move }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${col.label}, ${jobs.length} jobs`}
      className={cn(
        'flex w-64 shrink-0 flex-col rounded-xl bg-muted/50 p-2 transition-colors sm:w-72',
        isOver && 'bg-primary/10 ring-2 ring-primary/40',
      )}
    >
      <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
        {col.label}
        <span className="rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{jobs.length}</span>
      </h3>
      <ul className="flex min-h-16 flex-col gap-2">
        {jobs.map((j) => (
          <DraggableCard key={j.id} job={j} onMove={onMove} />
        ))}
        {jobs.length === 0 && (
          <li className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">Drop here</li>
        )}
      </ul>
    </section>
  )
}

export function KanbanBoard({ jobs }: { jobs: JobListItem[] }) {
  const change = useChangeJobStatus()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))
  const move: Move = (id, status) => change.mutate({ id, status })
  const active = jobs.find((j) => j.id === activeId)

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const job = jobs.find((j) => j.id === e.active.id)
    const col = KANBAN_COLUMNS.find((c) => c.key === e.over?.id)
    if (!job || !col || col.statuses.includes(job.status)) return
    move(job.id, col.statuses[0])
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="max-w-full overflow-x-auto pb-3">
        <div className="flex w-max gap-3">
          {KANBAN_COLUMNS.map((c) => (
            <KanbanColumn key={c.key} col={c} jobs={jobs.filter((j) => c.statuses.includes(j.status))} onMove={move} />
          ))}
        </div>
      </div>
      <DragOverlay>{active && <CardBody job={active} />}</DragOverlay>
    </DndContext>
  )
}
