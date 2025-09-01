import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This function must be deployed with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets set.
// supabase functions deploy set-role
// supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const { user_id, role } = await req.json();
    if (!user_id || !['owner', 'seeker'].includes(role)) {
      return new Response(JSON.stringify({ error: 'invalid input' }), { status: 400 });
    }

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      return new Response(JSON.stringify({ error: 'Function not configured' }), { status: 500 });
    }

    const admin = createClient(url, key);
    const { data, error } = await admin.auth.admin.updateUserById(user_id, {
      app_metadata: { role },
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, user: data.user }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
