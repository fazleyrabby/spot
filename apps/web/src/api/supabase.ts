import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://koqodifauvvemouhnjqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvcW9kaWZhdXZ2ZW1vdWhuanF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTk5ODYsImV4cCI6MjEwMzU5NTk4Nn0.hCknsp_62Qj0bj3Vlhe5gNftDYMiNGSv1vZa-Ib9OlI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function signInWithGitHub(redirectTo?: string) {
  const targetUrl = redirectTo || (typeof window !== 'undefined' ? window.location.href : 'http://localhost:4322');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: targetUrl,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
