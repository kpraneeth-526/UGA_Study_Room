// Supabase Edge Function: emails one queued bump notification.
// A Database Webhook calls this whenever a row is inserted into notifications.
//
// Secrets (Edge Functions > Secrets in the Supabase dashboard):
//   RESEND_API_KEY  - from resend.com
//   WEBHOOK_SECRET  - any random string; the webhook sends it in the x-webhook-secret header
//   DEMO_EMAIL      - optional; when set, every email goes here instead of the real recipient
//                     (Resend without a verified domain only delivers to the account owner)
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { record } = await req.json()

  // claim the row first so it is never emailed twice
  const { data: note } = await supabase
    .from('notifications')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', record.id)
    .is('sent_at', null)
    .select()
    .maybeSingle()
  if (!note) return new Response('Already sent')

  const demoTo = Deno.env.get('DEMO_EMAIL')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'UGA Study Rooms <onboarding@resend.dev>',
      to: demoTo || note.to_email,
      subject: note.subject,
      text: demoTo ? `(Demo: meant for ${note.to_email})\n\n${note.body}` : note.body,
    }),
  })

  // sending failed: un-claim the row so it can be retried
  if (!res.ok) {
    await supabase.from('notifications').update({ sent_at: null }).eq('id', note.id)
    return new Response(await res.text(), { status: 502 })
  }
  return new Response('Sent')
})
