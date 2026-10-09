import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, Sparkles } from 'lucide-react'
import {
  forgotPasswordInput,
  loginInput,
  registerInput,
  resetPasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
} from '@copilot/shared'
import { Field, invalidProps } from '@/components/common/field'
import { Spinner } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Logo } from '@/app/shell'
import { errorMessage } from '@/lib/api'
import { useDemoLogin, useForgotPassword, useLogin, useRegister, useResetPassword } from './api'
import { z } from 'zod'

function AuthLayout({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-4">
      <Logo className="mb-6 text-lg" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && <div className="mt-4 text-sm text-muted-foreground">{footer}</div>}
    </div>
  )
}

function DemoButton() {
  const demo = useDemoLogin()
  const navigate = useNavigate()
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={demo.isPending}
      onClick={() => demo.mutate(undefined, { onSuccess: () => navigate('/app/dashboard') })}
    >
      {demo.isPending ? <Spinner /> : <Sparkles />} Explore the demo instead
    </Button>
  )
}

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app/dashboard'
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginInput) })

  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to your workspace."
      footer={<>New here? <Link className="font-medium text-primary hover:underline" to="/register">Create an account</Link></>}
    >
      <form className="grid grid-cols-1 gap-4" noValidate onSubmit={handleSubmit((v) => login.mutate(v, { onSuccess: () => navigate(from, { replace: true }) }))}>
        {login.error && <Alert variant="destructive"><AlertDescription>{errorMessage(login.error)}</AlertDescription></Alert>}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} {...invalidProps('email', errors.email?.message)} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} {...invalidProps('password', errors.password?.message)} />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" disabled={login.isPending}>{login.isPending && <Spinner />} Log in</Button>
        <DemoButton />
      </form>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const reg = useRegister()
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({ resolver: zodResolver(registerInput) })

  return (
    <AuthLayout
      title="Create your account"
      description="Free forever. AI Pro features are invite-only."
      footer={<>Already have an account? <Link className="font-medium text-primary hover:underline" to="/login">Log in</Link></>}
    >
      <form className="grid grid-cols-1 gap-4" noValidate onSubmit={handleSubmit((v) => reg.mutate(v))}>
        {reg.error && <Alert variant="destructive"><AlertDescription>{errorMessage(reg.error)}</AlertDescription></Alert>}
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" {...register('name')} {...invalidProps('name', errors.name?.message)} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} {...invalidProps('email', errors.email?.message)} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="8+ characters with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} {...invalidProps('password', errors.password?.message)} />
        </Field>
        <Button type="submit" disabled={reg.isPending}>{reg.isPending && <Spinner />} Create account</Button>
        <DemoButton />
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const forgot = useForgotPassword()
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordInput) })

  return (
    <AuthLayout
      title="Reset your password"
      description="We'll email you a link to choose a new password."
      footer={<Link className="hover:underline" to="/login">Back to log in</Link>}
    >
      {forgot.isSuccess ? (
        <div className="grid grid-cols-1 gap-3 text-sm">
          <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {forgot.data.message}</p>
          {forgot.data.devResetLink && (
            <Alert>
              <AlertDescription>
                Development mode: email isn't sent (link is logged by the API). <Link className="font-medium text-primary underline" to={forgot.data.devResetLink}>Open the reset link</Link>
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <form className="grid grid-cols-1 gap-4" noValidate onSubmit={handleSubmit((v) => forgot.mutate(v))}>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register('email')} {...invalidProps('email', errors.email?.message)} />
          </Field>
          <Button type="submit" disabled={forgot.isPending}>{forgot.isPending && <Spinner />} Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  )
}

const resetForm = resetPasswordInput
  .extend({ confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const reset = useResetPassword()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof resetForm>>({
    resolver: zodResolver(resetForm),
    defaultValues: { token: params.get('token') ?? '' },
  })

  return (
    <AuthLayout title="Choose a new password" description="Make it at least 8 characters.">
      {done ? (
        <div className="grid grid-cols-1 gap-4 text-sm">
          <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Password updated.</p>
          <Button asChild><Link to="/login">Log in</Link></Button>
        </div>
      ) : (
        <form className="grid grid-cols-1 gap-4" noValidate onSubmit={handleSubmit(({ token, password }) => reset.mutate({ token, password }, { onSuccess: () => setDone(true) }))}>
          {(reset.error || !params.get('token')) && (
            <Alert variant="destructive"><AlertDescription>{reset.error ? errorMessage(reset.error) : 'This reset link is missing its token.'}</AlertDescription></Alert>
          )}
          <Field label="New password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} {...invalidProps('password', errors.password?.message)} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} {...invalidProps('confirm', errors.confirm?.message)} />
          </Field>
          <Button type="submit" disabled={reset.isPending}>{reset.isPending && <Spinner />} Update password</Button>
        </form>
      )}
    </AuthLayout>
  )
}
