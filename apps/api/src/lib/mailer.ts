import type { Logger } from './logger'

export type Mail = { to: string; subject: string; text: string }
export type Mailer = { send(mail: Mail): Promise<void>; driver?: 'resend' | 'console' }

/** Dev/test driver: logs the email instead of sending it. */
export const consoleMailer = (log: Logger): Mailer => ({
  driver: 'console',
  async send(mail) {
    log.info({ to: mail.to, subject: mail.subject }, `[mail] ${mail.text}`)
  },
})

export function resendMailer(opts: { apiKey: string; from: string }, log: Logger): Mailer {
  return {
    driver: 'resend',
    async send(mail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: opts.from,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).slice(0, 300)
        log.error({ status: res.status, body }, 'resend email failed')
        throw new Error(`Resend email failed with status ${res.status}`)
      }
    },
  }
}

const isResendKey = (k?: string): k is string => !!k && k.startsWith('re_') && k.length >= 20

export function createMailer(
  config: { RESEND_API_KEY?: string; MAIL_FROM: string },
  log: Logger,
): Mailer {
  const apiKey = config.RESEND_API_KEY
  return isResendKey(apiKey)
    ? resendMailer({ apiKey, from: config.MAIL_FROM }, log)
    : consoleMailer(log)
}
