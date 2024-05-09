import { defineConfig } from 'vite'

export default defineConfig({ base: globalThis.eval('process.env.BASE') })
