import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "https://vqonhdalfdcutojzntdw.supabase.co";
const SUPABASE_KEY = "";

export const cosmicSupabase = createClient(SUPABASE_URL, SUPABASE_KEY);
