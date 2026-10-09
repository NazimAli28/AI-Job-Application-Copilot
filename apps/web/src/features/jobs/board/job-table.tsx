import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { STATUS_LABELS } from '@copilot/shared'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { JobListItem } from '../api'
import { selectClass } from '../list-editors'
import { JobActions } from './job-actions'
import { ApplyByBadge, MatchCell, StatusBadge, formatDay } from './parts'

type SortKey = 'company' | 'title' | 'status' | 'match' | 'date'
type Dir = 1 | -1
type Sort = { key: SortKey; dir: Dir }

const COLS: { key: SortKey; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Position' },
  { key: 'status', label: 'Status' },
  { key: 'match', label: 'Match' },
  { key: 'date', label: 'Applied / saved' },
]

const dateOf = (j: JobListItem) => j.appliedAt ?? j.createdAt.slice(0, 10)

function value(j: JobListItem, k: SortKey): string | number {
  if (k === 'match') return j.matchScore ?? -1
  if (k === 'status') return STATUS_LABELS[j.status]
  if (k === 'date') return dateOf(j)
  return j[k].toLowerCase()
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map((t) => (
        <Badge key={t} variant="outline" className="text-[10px]">
          {t}
        </Badge>
      ))}
      {tags.length > 2 && (
        <Badge variant="outline" className="text-[10px]">
          +{tags.length - 2}
        </Badge>
      )}
    </div>
  )
}

export function JobTable({ jobs }: { jobs: JobListItem[] }) {
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: -1 })
  const rows = useMemo(
    () =>
      [...jobs].sort((x, y) => {
        const a = value(x, sort.key)
        const b = value(y, sort.key)
        return (a < b ? -1 : a > b ? 1 : 0) * sort.dir
      }),
    [jobs, sort],
  )
  const toggle = (key: SortKey) =>
    setSort((s) => {
      if (s.key === key) return { key, dir: s.dir === 1 ? -1 : 1 }
      return { key, dir: key === 'match' || key === 'date' ? -1 : 1 }
    })

  return (
    <>
      <div className="mb-3 md:hidden">
        <select
          aria-label="Sort jobs"
          className={selectClass}
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(':')
            setSort({ key: key as SortKey, dir: Number(dir) as Dir })
          }}
        >
          <option value="date:-1">Newest first</option>
          <option value="date:1">Oldest first</option>
          <option value="match:-1">Best match first</option>
          <option value="status:1">Status</option>
          <option value="company:1">Company A–Z</option>
        </select>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:hidden">
        {rows.map((j) => (
          <li key={j.id}>
            <Card className="flex-row items-start gap-2 p-3">
              <div className="min-w-0 flex-1">
                <Link to={`/app/jobs/${j.id}`} className="block truncate font-medium hover:underline">
                  {j.title}
                </Link>
                <p className="truncate text-sm text-muted-foreground">{j.company}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={j.status} />
                  <MatchCell job={j} />
                  <ApplyByBadge job={j} />
                  <span className="text-xs text-muted-foreground">{formatDay(dateOf(j))}</span>
                </div>
              </div>
              <JobActions job={j} />
            </Card>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLS.map((c) => {
                const active = sort.key === c.key
                const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
                return (
                  <TableHead key={c.key} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggle(c.key)}
                    >
                      {c.label} <Icon className="size-3.5" />
                    </button>
                  </TableHead>
                )
              })}
              <TableHead>Apply by</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="max-w-40 truncate font-medium">{j.company}</TableCell>
                <TableCell className="max-w-56 truncate">
                  <Link to={`/app/jobs/${j.id}`} className="hover:underline">
                    {j.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={j.status} />
                </TableCell>
                <TableCell>
                  <MatchCell job={j} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDay(dateOf(j))}</TableCell>
                <TableCell>
                  <ApplyByBadge job={j} always />
                </TableCell>
                <TableCell>
                  <Tags tags={j.tags} />
                </TableCell>
                <TableCell>
                  <JobActions job={j} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
