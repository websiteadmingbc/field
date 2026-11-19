// OpenAI TTS for Operations Ask Field voice replies.
// Deploy: npx supabase functions deploy ask-field-speak --remote=znkucrtehtyoatxfnozw --yes
// Secrets: OPENAI_API_KEY (shared with ask-field)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPS_ROLES = new Set(['admin', 'general_manager', 'operations_manager'])
const MAX_CHARS = 4000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const openaiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim()
    const voice = (Deno.env.get('OPENAI_TTS_VOICE') || 'alloy').trim()
    const model = (Deno.env.get('OPENAI_TTS_MODEL') || 'tts-1').trim()

    if (!openaiKey) {
      return json({ error: 'OPENAI_API_KEY is not configured' }, 503)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('app_role, active')
      .eq('id', caller.id)
      .maybeSingle()

    if (
      profileError ||
      !profile?.active ||
      !OPS_ROLES.has(String(profile.app_role))
    ) {
      return json({ error: 'Only Operations roles can use Ask Field voice' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    let text = String(body.text || '').trim()
    if (!text) return json({ error: 'text is required' }, 400)
    if (text.length > MAX_CHARS) {
      text = `${text.slice(0, MAX_CHARS - 20).trim()}…`
    }

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: 'mp3',
      }),
    })

    if (!ttsRes.ok) {
      const errText = await ttsRes.text()
      throw new Error(`TTS error (${ttsRes.status}): ${errText.slice(0, 400)}`)
    }

    const audio = new Uint8Array(await ttsRes.arrayBuffer())
    const audioBase64 = bytesToBase64(audio)

    return json({
      ok: true,
      content_type: 'audio/mpeg',
      audio_base64: audioBase64,
      voice,
      model,
      truncated: String(body.text || '').trim().length > MAX_CHARS,
    })
  } catch (err) {
    console.error('ask-field-speak error', err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
