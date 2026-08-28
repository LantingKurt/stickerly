import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(here, '..')
const logPath = path.join(workspaceRoot, 'debug-221c2c.log')

function agentLog(payload: Record<string, unknown>) {
  // #region agent log
  try {
    fs.appendFileSync(
      logPath,
      JSON.stringify({ sessionId: '221c2c', timestamp: Date.now(), ...payload }) + '\n',
    )
  } catch {
    /* ignore */
  }
  // #endregion
}

function debugLocalBuildProbe(): Plugin {
  return {
    name: 'debug-local-build-probe',
    config(_, { mode }) {
      const supabasePkg = path.join(here, 'node_modules', '@supabase', 'supabase-js', 'package.json')
      const env = loadEnv(mode, here, 'VITE_')
      // #region agent log
      agentLog({
        location: 'pastely/vite.config.ts:config',
        message: 'vite config probe',
        hypothesisId: 'A',
        data: {
          supabasePkgInstalled: fs.existsSync(supabasePkg),
          pastelyEnvLocalExists: fs.existsSync(path.join(here, '.env.local')),
          pastelyEnvExampleExists: fs.existsSync(path.join(here, '.env.example')),
          rootEnvLocalExists: fs.existsSync(path.join(workspaceRoot, '.env.local')),
          hasViteSupabaseUrl: Boolean(env.VITE_SUPABASE_URL),
          hasViteSupabaseAnonKey: Boolean(env.VITE_SUPABASE_ANON_KEY),
          mode,
        },
      })
      agentLog({
        location: 'pastely/vite.config.ts:env',
        message: 'vite env file probe',
        hypothesisId: 'B',
        data: {
          pastelyEnvLocalExists: fs.existsSync(path.join(here, '.env.local')),
          rootEnvLocalExists: fs.existsSync(path.join(workspaceRoot, '.env.local')),
          hasViteSupabaseUrl: Boolean(env.VITE_SUPABASE_URL),
          hasViteSupabaseAnonKey: Boolean(env.VITE_SUPABASE_ANON_KEY),
        },
      })
      // #endregion
    },
    resolveId(id) {
      if (id !== '@supabase/supabase-js') return
      const pkg = path.join(here, 'node_modules', '@supabase', 'supabase-js', 'package.json')
      // #region agent log
      agentLog({
        location: 'pastely/vite.config.ts:resolveId',
        message: 'resolving @supabase/supabase-js',
        hypothesisId: 'A',
        data: { id, pkgExists: fs.existsSync(pkg) },
      })
      // #endregion
    },
  }
}

// host + https so a phone on the same network can run the demo
// (getUserMedia requires a secure context; accept the self-signed cert once)
export default defineConfig({
  plugins: [debugLocalBuildProbe(), react(), basicSsl()],
  server: { host: true },
})
