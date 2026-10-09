/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_PREVIEW?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
