import { createAiProvider, createBackupProvider } from './ai/provider'
import { createApp } from './app'
import { loadConfig } from './config'
import { createDb } from './lib/db'
import { createLogger } from './lib/logger'
import { createMailer } from './lib/mailer'
import { createStorage } from './lib/storage'

const config = loadConfig()
const log = createLogger(config.LOG_LEVEL, !config.isProd)
const db = createDb(config.DATABASE_URL)
const storage = createStorage(config)
const mailer = createMailer(config, log)
log.info(`Storage: ${config.STORAGE_DRIVER}; mail: ${mailer.driver}`)
if (config.isProd && config.STORAGE_DRIVER === 'local')
  log.warn('STORAGE_DRIVER=local in production: hosted disks are ephemeral, uploads will be lost')
const aiProvider = createAiProvider(config)
const aiBackup = createBackupProvider(config)
const { ai } = config
log.info(
  aiProvider
    ? `AI Pro: ${ai.provider} (${ai.extractModel} / ${ai.generateModel})${ai.backup ? `, backup: free endpoint (${ai.backup.extractModel} / ${ai.backup.generateModel})` : ''}`
    : 'AI Pro: simulated engine (set ANTHROPIC_API_KEY or AI_API_KEY to use a real model)',
)
const app = createApp({
  config,
  db,
  log,
  mailer,
  storage,
  aiProvider,
  aiBackup,
})

const server = app.listen(config.PORT, () =>
  log.info(`API listening on http://localhost:${config.PORT}`),
)

async function shutdown(signal: string) {
  log.info(`${signal} received, shutting down`)
  server.close()
  await db.$disconnect()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
