import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://taodusjrsoxpnyirbneu.supabase.co'
const supabaseKey = 'sb_publishable_T_TinfVHGYCsNgl59KuUBg_CPYF8NPV'

export const supabase = createClient(supabaseUrl, supabaseKey)