// Minimal SMTP email server for OTP and verification links (POC)
import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load env for dev: try root .env.server, then server/.env.server, then .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootEnvServer = path.resolve(__dirname, '../.env.server')
const localEnvServer = path.resolve(__dirname, '.env.server')
if (fs.existsSync(rootEnvServer)) {
  dotenv.config({ path: rootEnvServer })
} else if (fs.existsSync(localEnvServer)) {
  dotenv.config({ path: localEnvServer })
} else {
  dotenv.config()
}

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// In-memory store for POC (cleared on restart)
const store = {
  otp: new Map(), // email -> { code, expiresAt }
  tokens: new Map(), // token -> { email, expiresAt }
}

function minutes(n) { return n * 60 * 1000 }

function smtpTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true' || port === 465
  const tls = {}
  if (process.env.SMTP_TLS_SERVERNAME) {
    tls.servername = process.env.SMTP_TLS_SERVERNAME
  }
  if (String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true') === 'false') {
    tls.rejectUnauthorized = false
  }
  const authUser = process.env.SMTP_AUTH_USER || user
  const authMethod = process.env.SMTP_AUTH_METHOD // e.g. 'LOGIN' or 'PLAIN'
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || 'false') === 'true'
  if (!host || !user || !pass) {
    const missing = [
      !host ? 'SMTP_HOST' : null,
      !user ? 'SMTP_USER' : null,
      !pass ? 'SMTP_PASS' : null,
    ].filter(Boolean)
    throw new Error(`SMTP env not configured. Missing: ${missing.join(', ')}. Loaded from: ${rootEnvServer} or ${localEnvServer}`)
  }
  const debug = String(process.env.SMTP_DEBUG || 'false') === 'true'
  const transportOptions = { host, port, secure, requireTLS, auth: { user: authUser, pass }, tls, logger: debug, debug }
  if (authMethod) transportOptions.authMethod = authMethod
  return nodemailer.createTransport(transportOptions)
}

function appBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`
}

async function getTransporterWithFallback() {
  try {
    const t = smtpTransport()
    await t.verify()
    return { transporter: t, preview: false }
  } catch (e) {
    if (String(process.env.SMTP_ALLOW_ETHEREAL || 'false') === 'true') {
      const test = await nodemailer.createTestAccount()
      const t = nodemailer.createTransport({
        host: test.smtp.host,
        port: test.smtp.port,
        secure: test.smtp.secure,
        auth: { user: test.user, pass: test.pass },
      })
      return { transporter: t, preview: true }
    }
    throw e
  }
}

app.post('/api/email/otp', async (req, res) => {
  try {
    const { email, name } = req.body || {}
    if (!email) return res.status(400).json({ message: 'email is required' })
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + minutes(10)
    store.otp.set(email.toLowerCase(), { code, expiresAt })

    const { transporter, preview } = await getTransporterWithFallback()
    const from = process.env.SMTP_FROM || process.env.SMTP_USER
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Your verification code',
      text: `Hi${name ? ' ' + name : ''}, your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Hi${name ? ' ' + name : ''},</p><p>Your verification code is <b style="font-size:18px">${code}</b>.</p><p>This code expires in 10 minutes.</p>`,
    })
    const previewUrl = preview ? nodemailer.getTestMessageUrl(info) : undefined
    res.json({ ok: true, previewUrl })
  } catch (e) {
    res.status(500).json({ message: e.message || 'send otp failed' })
  }
})

app.post('/api/email/verify-otp', (req, res) => {
  try {
    const { email, code } = req.body || {}
    if (!email || !code) return res.status(400).json({ message: 'email and code are required' })
    const rec = store.otp.get(email.toLowerCase())
    if (!rec) return res.status(400).json({ ok: false, message: 'no otp' })
    if (Date.now() > rec.expiresAt) return res.status(400).json({ ok: false, message: 'otp expired' })
    if (String(code) !== rec.code) return res.status(400).json({ ok: false, message: 'invalid code' })
    store.otp.delete(email.toLowerCase())
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ message: e.message || 'verify otp failed' })
  }
})

app.post('/api/email/verify-link', async (req, res) => {
  try {
    const { email, name } = req.body || {}
    if (!email) return res.status(400).json({ message: 'email is required' })
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const expiresAt = Date.now() + minutes(60)
    store.tokens.set(token, { email: email.toLowerCase(), expiresAt })

    const link = `${appBaseUrl(req)}/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    const { transporter, preview } = await getTransporterWithFallback()
    const from = process.env.SMTP_FROM || process.env.SMTP_USER
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your account',
      text: `Hi${name ? ' ' + name : ''}, click to verify: ${link}`,
      html: `<p>Hi${name ? ' ' + name : ''},</p><p>Please verify your account by clicking the link below:</p><p><a href="${link}">Verify Account</a></p><p>This link expires in 60 minutes.</p>`,
    })
    const previewUrl = preview ? nodemailer.getTestMessageUrl(info) : undefined
    res.json({ ok: true, previewUrl })
  } catch (e) {
    res.status(500).json({ message: e.message || 'send link failed' })
  }
})

app.get('/api/email/verify-link/validate', (req, res) => {
  try {
    const { token, email } = req.query || {}
    if (!token || !email) return res.status(400).json({ ok: false, message: 'token and email are required' })
    const rec = store.tokens.get(String(token))
    if (!rec || rec.email !== String(email).toLowerCase()) return res.status(400).json({ ok: false, message: 'invalid token' })
    if (Date.now() > rec.expiresAt) return res.status(400).json({ ok: false, message: 'token expired' })
    // One-time use
    store.tokens.delete(String(token))
    res.json({ ok: true, email: rec.email })
  } catch (e) {
    res.status(500).json({ message: e.message || 'validate link failed' })
  }
})

// Quick diagnostics: verify SMTP credentials/connectivity
app.get('/api/email/verify-smtp', async (req, res) => {
  try {
    const transporter = smtpTransport()
    await transporter.verify()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || 'verify failed' })
  }
})

app.listen(PORT, () => {
  console.log(`SMTP helper server listening on http://localhost:${PORT}`)
})
