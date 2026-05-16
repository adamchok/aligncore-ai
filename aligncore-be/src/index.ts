import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

import { wahaRouter } from './routes/waha'
import { matchRouter } from './routes/match'
import { chatRouter } from './routes/chat'
import { demoRouter } from './routes/demo'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/waha', wahaRouter)
app.use('/api/match', matchRouter)
app.use('/api/chat', chatRouter)
app.use('/api/demo', demoRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[aligncore-be] listening on http://localhost:${PORT}`)
})

export default app
