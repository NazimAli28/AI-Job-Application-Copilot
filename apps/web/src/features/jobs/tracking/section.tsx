import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/common/states'

/** Card with an explicit Save button (disabled until something changed). */
export function Section({
  title,
  description,
  dirty,
  pending,
  onSave,
  children,
  saveLabel = 'Save',
}: {
  title: string
  description?: ReactNode
  dirty: boolean
  pending: boolean
  onSave: () => void
  children: ReactNode
  saveLabel?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        {children}
        <div>
          <Button size="sm" disabled={!dirty || pending} onClick={onSave}>
            {pending && <Spinner />} {saveLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
