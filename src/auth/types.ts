export type AuthUser = {
  id: string
  email: string
  name?: string
  picture?: string
  provider: 'local' | 'google'
  token?: string
  verified?: boolean
}
