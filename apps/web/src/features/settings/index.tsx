import { Monitor, Moon, Sun } from 'lucide-react'
import { PageHeader } from '@/components/common/states'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCurrentUser } from '@/features/auth/api'
import { useTheme } from '@/lib/theme'
import { AiAccessSection } from './ai-access-section'
import { PrivacySection } from './privacy-section'

export { AdminPage } from './admin-page'

export function SettingsPage() {
  const user = useCurrentUser()
  const { theme, setTheme } = useTheme()
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Account, appearance, AI access and your data." />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Editing account details isn&apos;t available in the prototype.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-1 gap-1.5">
              <Label htmlFor="acct-name">Name</Label>
              <Input id="acct-name" value={user.name} readOnly />
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <Label htmlFor="acct-email">Email</Label>
              <Input id="acct-email" value={user.email} readOnly />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(v) => v && setTheme(v as 'light' | 'dark' | 'system')}
              aria-label="Theme"
            >
              <ToggleGroupItem value="light">
                <Sun /> Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark">
                <Moon /> Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system">
                <Monitor /> System
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>

        <AiAccessSection />
        <PrivacySection />
      </div>
    </div>
  )
}
