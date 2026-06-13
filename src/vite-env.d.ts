/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_INVENTORY_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
