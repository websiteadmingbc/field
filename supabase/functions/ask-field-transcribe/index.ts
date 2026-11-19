// Whisper STT for Operations Ask Field voice input.
// Deploy: npx supabase functions deploy ask-field-transcribe --remote=znkucrtehtyoatxfnozw --yes
// Secrets: OPENAI_API_KEY (shared with ask-field)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPS_ROLES = new Set(['admin', 'general_manager', 'operations_manager'])
const MAX_BYTES = 8 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const openaiKey = (Deno.env.get('OPENAI_API_KEY') || '').trim()

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
    const audioBase64 = String(body.audio_base64 || '').replace(/^data:[^;]+;base64,/, '')
    const mimeType = String(body.mime_type || 'audio/webm')
    if (!audioBase64) return json({ error: 'audio_base64 is required' }, 400)

    const binary = base64ToBytes(audioBase64)
    if (binary.byteLength === 0) return json({ error: 'Empty audio' }, 400)
    if (binary.byteLength > MAX_BYTES) {
      return json({ error: 'Audio is too large (max 8MB). Record a shorter clip.' }, 400)
    }

    const ext = extensionForMime(mimeType)
    const form = new FormData()
    form.append(
      'file',
      new Blob([binary], { type: mimeType }),
      `ask-field.${ext}`,
    )
    form.append('model', 'whisper-1')
    form.append('language', 'en')
    form.append('response_format', 'json')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    })

    if (!whisperRes.ok) {
      const text = await whisperRes.text()
      throw new Error(`Whisper error (${whisperRes.status}): ${text.slice(0, 400)}`)
    }

    const whisperJson = await whisperRes.json()
    const transcript = String(whisperJson.text || '').trim()
    if (!transcript) {
      return json({ error: 'No speech detected. Try again closer to the mic.' }, 400)
    }

    return json({ ok: true, text: transcript })
  } catch (err) {
    console.error('ask-field-transcribe error', err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})

function extensionForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
