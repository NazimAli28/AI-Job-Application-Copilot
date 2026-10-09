import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useDevTier } from '@/features/auth/api'
import { api } from '@/lib/api'
import { runtime } from '@/lib/runtime'

/**
 * Dev-only: preview the Free vs AI Pro experience and admin view (`/dev/tier`, non-prod API or
 * mocks). Never rendered in production builds or for the demo account.
 */
export function DevToolbar() {
  const user = useCurrentUser()
  const tier = useDevTier()
  const [open, setOpen] = useState(false)
  if (import.meta.env.PROD || user.isDemo) return null

  if (!open)
    return (
      <Button
        size="icon"
        variant="outline"
        className="fixed right-4 bottom-4 z-50 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open prototype toolbar"
      >
        <FlaskConical />
      </Button>
    )

  return (
    <div className="fixed right-4 bottom-4 z-50 w-64 rounded-xl border bg-popover p-3 text-sm shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Prototype toolbar</span>
        <Button size="icon-xs" variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
          <X />
        </Button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">Preview tiers (dev only).</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={user.aiAccess ? 'outline' : 'default'}
          onClick={() => tier.mutate({ aiAccess: false })}
        >
          Free
        </Button>
        <Button
          size="sm"
          variant={user.aiAccess ? 'default' : 'outline'}
          onClick={() => tier.mutate({ aiAccess: true })}
        >
          AI Pro
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="col-span-2"
          onClick={() => tier.mutate({ role: user.role === 'admin' ? 'user' : 'admin' })}
        >
          {user.role === 'admin' ? 'Leave admin view' : 'Admin view'}
        </Button>
        {runtime.mocks && (
          <Button
            size="sm"
            variant="destructive"
            className="col-span-2"
            onClick={async () => {
              await api.post('/dev/reset')
              window.location.assign('/')
            }}
          >
            Reset all mock data
          </Button>
        )}
      </div>
    </div>
  )
}
