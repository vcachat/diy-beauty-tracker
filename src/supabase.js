import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nshglhvnczhvdgfxjetb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zaGdsaHZuY3podmRnZnhqZXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDMxMjAsImV4cCI6MjA5MjQ3OTEyMH0.We1aq1O1lYI_J8iJVdtd8SGTFjvsiLBeG-5WKkSZ6B0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
