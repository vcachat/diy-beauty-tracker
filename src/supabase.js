import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nshglhvnczhvdgfxjetb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Em8lwSLTdbYRiKwUkw-jYw_Sj0o_xpY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
