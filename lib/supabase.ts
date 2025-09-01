import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Soft warn in dev
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper: set role using Edge Function (uses service role on server)
export async function setUserRole(role: 'owner' | 'seeker') {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw new Error(userErr?.message || 'Not authenticated');
  const user_id = userRes.user.id;

  const { data, error } = await supabase.functions.invoke('set-role', {
    body: { user_id, role },
  });
  if (error) throw new Error(error.message);

  // Ensure JWT contains latest app_metadata.role
  await supabase.auth.refreshSession();
  return data;
}
