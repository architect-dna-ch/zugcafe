import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const url = rawUrl.startsWith('http') ? rawUrl : 'https://xyzcompanyxyz.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

export const supabase = createClient(url, key)
