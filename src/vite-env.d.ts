/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string
  readonly VITE_PRODUCT_ID_IMAGE?: string
  readonly VITE_PRODUCT_ID_MUSIC?: string
  readonly VITE_PRODUCT_ID_BALANCE?: string
  readonly VITE_MEMBER_ID?: string
  readonly VITE_MEMBERSHIP_TIER_ID?: string
  readonly VITE_MUSIC_URL?: string
  readonly VITE_HISTORY_ENDPOINT?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
