import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  User as UserIcon,
} from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useCurrentUser, useLogout } from '@/features/auth/api'
import { DevToolbar } from './dev-toolbar'

export const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/analyze', label: 'Check my fit', icon: Target },
  { to: '/app/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/app/resume', label: 'Resumes', icon: FileText },
  { to: '/app/profile', label: 'My Profile', icon: UserIcon },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-heading font-semibold ${className}`}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <span className="truncate">Job Copilot</span>
    </Link>
  )
}

function NavItems() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const user = useCurrentUser()
  const items = user.role === 'admin' ? [...NAV, { to: '/app/admin', label: 'Admin', icon: ShieldCheck }] : NAV
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={item.label}>
            <NavLink to={item.to} onClick={() => setOpenMobile(false)}>
              <item.icon />
              <span>{item.label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-1.5">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          {user.aiAccess ? (
            <Badge className="bg-primary/10 text-primary">AI Pro</Badge>
          ) : (
            <Badge variant="secondary">Free</Badge>
          )}
          {user.isDemo && <Badge variant="outline">Demo</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />} Toggle theme
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/app/settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DemoBanner() {
  const user = useCurrentUser()
  if (!user.isDemo) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-primary/10 px-4 py-2 text-center text-sm">
      <span>You&apos;re exploring a read-only demo with sample data and real AI Pro results.</span>
      <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
        Create a free account →
      </Link>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const current = [...NAV, { to: '/app/admin', label: 'Admin' }, { to: '/app/interviews', label: 'Interview practice' }].find((n) => pathname.startsWith(n.to))
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center px-3">
          <Logo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <NavItems />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <DemoBanner />
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger aria-label="Toggle navigation" />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <span className="text-sm font-medium">{current?.label}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
      <DevToolbar />
    </SidebarProvider>
  )
}
