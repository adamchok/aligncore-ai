import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

import { wahaRouter } from './routes/waha'
import { matchRouter } from './routes/match'
import { chatRouter } from './routes/chat'
import { entitiesRouter } from './routes/entities'
import { aiRouter } from './routes/ai'
import { aiExtractRouter } from './routes/aiExtract'
import { csvImportRouter } from './routes/csvImport'
import { docExtractRouter } from './routes/docExtract'
import { knowledgeRouter } from './routes/knowledge'
import { gmailRouter } from './routes/gmail'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FE_ORIGIN?.trim() || true,
  })
)
app.use(express.json())

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/waha', wahaRouter)
app.use('/api/match', matchRouter)
app.use('/api/chat', chatRouter)
app.use('/api/entities', entitiesRouter)
app.use('/api/entities', csvImportRouter)
app.use('/api/ai', aiRouter)
app.use('/api/ai', aiExtractRouter)
app.use('/api/ai', docExtractRouter)
app.use('/api/knowledge', knowledgeRouter)
app.use('/api/gmail', gmailRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[aligncore-be] listening on http://localhost:${PORT}`)
})

export default app
