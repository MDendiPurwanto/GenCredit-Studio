// Very simple local-storage based auth for POC
export type LocalUser = {
  id: string
  email: string
  password: string // POC only. Do NOT use plaintext in production.
  name?: string
}

const KEY = 'localUsers'

function readUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LocalUser[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: LocalUser[]) {
  localStorage.setItem(KEY, JSON.stringify(users))
}

export function register(email: string, password: string, name?: string): LocalUser {
  const users = readUsers()
  const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase())
  if (exists) throw new Error('Email already registered')
  const user: LocalUser = {
    id: Math.random().toString(36).slice(2),
    email,
    password,
    name,
  }
  users.push(user)
  writeUsers(users)
  return user
}

export function login(email: string, password: string): LocalUser {
  const users = readUsers()
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
  if (!found || found.password !== password) throw new Error('Invalid credentials')
  return found
}

