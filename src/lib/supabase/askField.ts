import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase } from './client'

export type AskFieldPresetId =
  | 'ops_briefing'
  | 'pipeline'
  | 'team'
  | 'notices'
  | 'customer_comms'

export const ASK_FIELD_PRESETS: {
  id: AskFieldPresetId
  label: string
  description: string
  prompt: string
}[] = [
  {
    id: 'ops_briefing',
    label: '30-second ops brief',
    description: 'What’s in progress, who’s on the team, recent notices',
    prompt:
      'Give a 30-second operations briefing: what’s in progress, who’s on the team, and any recent notices. Highlight risks and what needs a decision.',
  },
  {
    id: 'pipeline',
    label: 'Job pipeline',
    description: 'In progress, on hold, and scheduled',
    prompt:
      'Summarize the job pipeline. List in_progress and on_hold jobs first, then upcoming scheduled. Call out anything that looks stuck.',
  },
  {
    id: 'team',
    label: 'Team snapshot',
    description: 'Active people and roles',
    prompt:
      'Give a short team snapshot: active people by role, and note who the operations leadership is.',
  },
  {
    id: 'notices',
    label: 'Recent notices',
    description: 'Latest site notices across jobs',
    prompt:
      'List the most recent site notices and what they imply for ops today. Tie each notice to a job when possible.',
  },
  {
    id: 'customer_comms',
    label: 'Customer communications',
    description: 'Recent customer conversation logs',
    prompt:
      'Summarize recent customer communications. Call out urgent or high priority items and anything Operations should follow up on.',
  },
]

export type AskFieldResult = {
  ok: true
  answer: string
  preset: string | null
  tools_used: string[]
  model: string
  asked_by: string | null
}

export async function askField(input: {
  prompt: string
  preset?: AskFieldPresetId | null
}): Promise<AskFieldResult> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase is not configured. Ask Field needs a live Field connection.')
  }

  const { data, error } = await supabase.functions.invoke('ask-field', {
    body: {
      prompt: input.prompt,
      preset: input.preset ?? null,
    },
  })

  if (data?.error) {
    throw new Error(String(data.error))
  }

  if (error) {
    throw new Error(await messageFromFunctionsError(error))
  }

  if (!data?.answer) {
    throw new Error('Ask Field returned an empty answer.')
  }

  return data as AskFieldResult
}

export async function transcribeAskFieldAudio(input: {
  audioBase64: string
  mimeType: string
}): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase is not configured. Ask Field needs a live Field connection.')
  }

  const { data, error } = await supabase.functions.invoke('ask-field-transcribe', {
    body: {
      audio_base64: input.audioBase64,
      mime_type: input.mimeType,
    },
  })

  if (data?.error) throw new Error(String(data.error))
  if (error) throw new Error(await messageFromFunctionsError(error))
  if (!data?.text) throw new Error('Transcription returned empty text.')
  return String(data.text)
}

export async function speakAskFieldAnswer(text: string): Promise<{
  audioUrl: string
  voice: string
  model: string
}> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase is not configured. Ask Field needs a live Field connection.')
  }

  const { data, error } = await supabase.functions.invoke('ask-field-speak', {
    body: { text },
  })

  if (data?.error) throw new Error(String(data.error))
  if (error) throw new Error(await messageFromFunctionsError(error))
  if (!data?.audio_base64) throw new Error('TTS returned no audio.')

  const contentType = String(data.content_type || 'audio/mpeg')
  const audioUrl = `data:${contentType};base64,${data.audio_base64}`
  return {
    audioUrl,
    voice: String(data.voice || 'alloy'),
    model: String(data.model || 'tts-1'),
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function messageFromFunctionsError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        return String(body.error)
      }
      if (typeof body === 'string' && body.trim()) return body.trim()
    } catch {
      try {
        const text = await error.context.text()
        if (text.trim()) return text.trim().slice(0, 500)
      } catch {
        // fall through
      }
    }
  }

  if (error instanceof Error && error.message) {
    if (/non-2xx/i.test(error.message)) {
      return `${error.message}. Check OPENAI_API_KEY is set and the ask-field function is deployed.`
    }
    return error.message
  }

  return 'Ask Field failed. Deploy the ask-field Edge Function and set OPENAI_API_KEY.'
}
