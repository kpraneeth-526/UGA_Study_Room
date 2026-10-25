// Supabase Edge Function: booking chatbot.
// The app sends the conversation so far; Claude pulls out group size, date, time,
// duration and library, asks a follow-up question if anything is missing, and
// once everything is known this function searches for free rooms.
//
// Request body:  { "messages": [{ "role": "user", "content": "room for 4 at 3pm" }, ...] }
// Response body: { "reply": "...", "rooms": [...], "booking": { location_id, start, end, group_size } | null }
// To book, the app calls create_booking with booking.start, booking.end, booking.group_size
// and the chosen room's id.
//
// Secrets (Edge Functions > Secrets in the Supabase dashboard):
//   ANTHROPIC_API_KEY - from console.anthropic.com
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MAX_MINUTES = 120
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const nullable = (type: string) => ({ anyOf: [{ type }, { type: 'null' }] })
const schema = {
  type: 'object',
  properties: {
    group_size: nullable('integer'),
    date: nullable('string'),             // YYYY-MM-DD
    start_time: nullable('string'),       // HH:MM, 24-hour
    duration_minutes: nullable('integer'),
    location_id: nullable('integer'),
    reply: { type: 'string' },
  },
  required: ['group_size', 'date', 'start_time', 'duration_minutes', 'location_id', 'reply'],
  additionalProperties: false,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// UTC offset for a New York wall-clock time, e.g. "-04:00" (EDT) or "-05:00" (EST)
function nyOffset(date: string, time: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(`${date}T${time}:00Z`))
  return parts.find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '') || '+00:00'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { messages } = await req.json().catch(() => ({}))
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Send { messages: [{ role: "user", content: "..." }] }' }, 400)
  }
  // keep requests small: last 10 turns, 500 characters each
  const history: Anthropic.MessageParam[] = messages.slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 500),
  }))

  const { data: locations } = await supabase.from('locations').select('id, name').order('id')
  const now = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date())

  const system = `You help University of Georgia students book study rooms.
Current date and time in Athens, Georgia: ${now}.
Libraries (use the id): ${(locations ?? []).map((l) => `${l.id} = ${l.name}`).join('; ')}.

From the conversation, fill in group_size, date (YYYY-MM-DD), start_time (HH:MM, 24-hour),
duration_minutes, and location_id. Resolve relative phrases like "tomorrow" or "this afternoon"
(use 14:00 for afternoon, 18:00 for evening, 10:00 for morning when no time is given).
Use null for anything the student has not said and you cannot reasonably infer.
Bookings are limited to 2 hours; if the student asks for longer, set duration_minutes to 120 and
say in reply that you searched for 2 hours (the limit) and they can book another slot right after.

reply: one or two short, friendly sentences to the student. If anything is null, ask only for
the missing details. If everything is filled in, say what you are searching for.`

  let extracted
  try {
    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system,
      messages: history,
    })
    if (response.stop_reason === 'refusal') {
      return json({ reply: "Sorry, I can't help with that. Try describing the room you need.", rooms: [], booking: null })
    }
    const text = response.content.find((b) => b.type === 'text')
    extracted = JSON.parse(text && text.type === 'text' ? text.text : '{}')
  } catch (err) {
    console.error(err)
    return json({ reply: 'The assistant is unavailable right now. Please use the search form.', rooms: [], booking: null }, 502)
  }

  const { group_size, date, start_time, location_id } = extracted
  let { reply } = extracted
  const complete = group_size > 0 && extracted.duration_minutes > 0 && location_id &&
    /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && /^\d{2}:\d{2}$/.test(start_time ?? '')
  if (!complete) return json({ reply, rooms: [], booking: null })

  const duration_minutes = Math.min(extracted.duration_minutes, MAX_MINUTES)

  const start = `${date}T${start_time}:00${nyOffset(date, start_time)}`
  const end = new Date(Date.parse(start) + duration_minutes * 60_000).toISOString()
  if (Date.parse(start) < Date.now() - 5 * 60_000) {
    return json({ reply: 'That time has already passed. What time would you like instead?', rooms: [], booking: null })
  }

  const { data: rooms, error } = await supabase.rpc('get_available_rooms', {
    p_location_id: location_id,
    p_start: start,
    p_end: end,
    p_group_size: group_size,
  })
  if (error) {
    console.error(error)
    return json({ reply: 'Something went wrong searching for rooms. Please try again.', rooms: [], booking: null }, 500)
  }
  if (rooms.length === 0) {
    reply = 'No rooms are free for that time and group size. Want to try a different time or library?'
  }
  return json({ reply, rooms, booking: { location_id, start, end, group_size } })
})
