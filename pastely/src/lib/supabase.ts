import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// #region agent log
fetch('http://127.0.0.1:7834/ingest/3d251863-5447-43b8-a393-d879be895c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'221c2c'},body:JSON.stringify({sessionId:'221c2c',location:'pastely/src/lib/supabase.ts',message:'supabase module evaluating',data:{hasUrl:Boolean(url),hasKey:Boolean(key)},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
// #endregion

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, key)
