import { useState, type ReactNode } from 'react'
import { Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { ConfirmAction } from '@/components/common/confirm'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCollection, type CollectionName } from '../api'

export type FormProps<T> = { item?: T; onDone: () => void }

/** List of items with add/edit dialog and confirmed delete — shared by experience, education, projects, certifications. */
export function CrudSection<T extends { id: string }>({
  name,
  noun,
  icon,
  emptyText,
  items,
  renderItem,
  Form,
}: {
  name: CollectionName
  noun: string
  icon: LucideIcon
  emptyText: string
  items: T[]
  renderItem: (item: T) => ReactNode
  Form: (props: FormProps<T>) => ReactNode
}) {
  const [editing, setEditing] = useState<T | 'new' | null>(null)
  const { remove } = useCollection<T>(name)
  const close = () => setEditing(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus /> Add {noun}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={icon}
          title={`No ${noun} yet`}
          description={emptyText}
          action={
            <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
              <Plus /> Add {noun}
            </Button>
          }
        />
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-start gap-3">
              <div className="min-w-0 flex-1">{renderItem(item)}</div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${noun}`} onClick={() => setEditing(item)}>
                  <Pencil />
                </Button>
                <ConfirmAction
                  title={`Delete this ${noun}?`}
                  description="This removes it from your profile and affects future match scores. This can't be undone."
                  onConfirm={() => remove.mutate(item.id)}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${noun}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? `Add ${noun}` : `Edit ${noun}`}</DialogTitle>
            <DialogDescription>Changes are saved when you press Save.</DialogDescription>
          </DialogHeader>
          {editing !== null && <Form item={editing === 'new' ? undefined : editing} onDone={close} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
