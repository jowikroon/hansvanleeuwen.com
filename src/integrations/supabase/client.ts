import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Primary Supabase project: pesfakewujjwkyybwaom (shared with marketplacegrowth.nl)
// Blog tables (hvl_blog_articles, hvl_voice_templates, hvl_blog_revisions, hvl_blog_agent_reviews) live here
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://pesfakewujjwkyybwaom.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc2Zha2V3dWpqd2t5eWJ3YW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzcyNzQsImV4cCI6MjA4NzQ1MzI3NH0.6jTLT1MbeTKhxVW5ATtDnkRa02N-X5zlt3zGgFVA3iU";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
