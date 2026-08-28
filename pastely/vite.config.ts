import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// host + https so a phone on the same network can run the demo
// (getUserMedia requires a secure context; accept the self-signed cert once)
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { host: true },
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
  },
})
