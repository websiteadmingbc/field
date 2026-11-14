// Supabase Edge Function: invite a user and set their profile.
// Deploy: npx supabase functions deploy invite-user --project-ref znkucrtehtyoatxfnozw
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401)
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: callerProfile, error: profileError } = await admin
      .from('profiles')
      .select('app_role, active')
      .eq('id', caller.id)
      .maybeSingle()

    const canInvite =
      callerProfile?.active &&
      (callerProfile.app_role === 'admin' ||
        callerProfile.app_role === 'general_manager' ||
        callerProfile.app_role === 'operations_manager')
    if (profileError || !canInvite) {
      return json({ error: 'Only Owner/Admin, General Manager, or Operations Manager can invite users' }, 403)
    }

    const body = await req.json()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const full_name = String(body.full_name || '').trim()
    const title = String(body.title || '').trim()
    const phone = String(body.phone || '').trim()
    const app_role = String(body.app_role || 'tradesperson')

    if (!email || !full_name) {
      return json({ error: 'Email and full name are required' }, 400)
    }

    const allowed = [
      'admin',
      'general_manager',
      'operations_manager',
      'estimator',
      'office_manager',
      'bookkeeper',
      'project_manager',
      'project_coordinator',
      'project_engineer',
      'site_supervisor',
      'safety_officer',
      'crew_lead',
      'crew',
      'tradesperson',
      'equipment_operator',
      'laborer',
      'apprentice',
      'subcontractor',
      'client',
    ]
    if (!allowed.includes(app_role)) {
      return json({ error: 'Invalid app role' }, 400)
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, app_role },
      redirectTo: `${Deno.env.get('SITE_URL') || 'https://field.greatbrittongc.com'}/auth/callback`,
    })

    if (inviteError) {
      // Fall back to create if already partially provisioned
      if (/already|registered|exists/i.test(inviteError.message)) {
        const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 })
        const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email)
        if (!existing) return json({ error: inviteError.message }, 400)
        await admin.from('profiles').upsert({
          id: existing.id,
          email,
          full_name,
          title: title || null,
          phone: phone || null,
          app_role,
          active: true,
        })
        return json({ ok: true, id: existing.id, existed: true })
      }
      return json({ error: inviteError.message }, 400)
    }

    const userId = invited.user?.id
    if (!userId) return json({ error: 'Invite created but no user id returned' }, 500)

    const { error: upsertError } = await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name,
      title: title || null,
      phone: phone || null,
      app_role,
      active: true,
    })
    if (upsertError) return json({ error: upsertError.message }, 400)

    return json({ ok: true, id: userId })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
