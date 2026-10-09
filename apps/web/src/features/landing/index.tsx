import { Link } from 'react-router'
import { Logo } from '@/app/shell'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/api'
import { Hero } from './hero'
import { Faq, Features, HowItWorks, Pricing, Principles } from './sections'

export function LandingPage() {
  const { data: user } = useMe()
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button size="sm" asChild>
                <Link to="/app/dashboard">Open app</Link>
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <Principles />
        <Faq />
      </main>
      <footer className="border-t py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Portfolio prototype. Estimated fit scores are guidance, not hiring predictions.</p>
        </div>
      </footer>
    </div>
  )
}
