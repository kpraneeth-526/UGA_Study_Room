# Frontend guide

This guide explains how the website talks to the backend. The backend is finished and tested:
Supabase holds the database, the booking rules, the emails and the chatbot. The frontend's
job is the screens. You never need to write SQL or server code. Every action is one
`supabase.rpc(...)` or `supabase.functions.invoke(...)` call from React.

Screens the app needs: **find a room** (search + book, with a club option), **chatbot**, and
**my booking** (look up by code + email, check in, cancel, rebook after a bump).

## Setup

1. `npm install`
2. Create a file named `.env.local` in the project root (ask Praneeth for the key):
   ```
   VITE_SUPABASE_URL=https://zvpowmhxaoctlebesfga.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
   `.env.local` is gitignored, so never commit it. The publishable key is safe in the browser.
   **Never** use the `service_role` / secret key in frontend code.
3. `npm run dev` and open http://localhost:5173. Restart `npm run dev` after editing `.env.local`.

The client is already set up in `src/supabase.js`: `import { supabase } from './supabase'`.

## Booking rules the UI should follow

The backend enforces all of these and returns a readable error if one is broken, so the UI
just needs to guide people and **show `error.message`** when something fails.

| Rule | What the UI should do |
|---|---|
| Times are on 15-minute steps (:00, :15, :30, :45) | Use a time dropdown in 15-minute steps, not a free time input |
| Bookings are 2 hours max | Offer lengths of 30 min, 1 h, 1.5 h and 2 h |
| Up to 14 days ahead | Date picker min = today, max = today + 14 days |
| The current 15-minute slot can still be booked | Default the start time to the current slot (e.g. 3:00 at 3:07 PM) |
| One active booking per email per day | Show the error. Cancelled/bumped/released bookings don't count |
| Students can book any study room | |
| Clubs need their club + 8-character access code | Club dropdown + access code field |
| Clubs: Barr Seminar Room any time; every other room only from **6 PM on weekdays or all weekend** | Explain this on the club booking form |
| Priority: professional clubs > clubs > students. During club hours a club can take ("bump") a student's room | Warn when a search result has `would_bump: true` |
| Check in within 15 minutes of the start, or the booking is released | Remind people after booking, and give them a check-in button |

**Times:** everything is in Athens time (America/New_York). Always send times **with a
timezone offset**, e.g. `"2026-11-03T18:00:00-05:00"`. Don't use a bare `"2026-11-03T18:00"`,
because that shifts by the viewer's timezone. This helper builds the right string,
including the EDT/EST switch:

```js
// toIso('2026-11-03', '18:00') -> '2026-11-03T18:00:00-05:00'
function toIso(date, time) {
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${date}T${time}:00Z`))
    .find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00'
  return `${date}T${time}:00${offset}`
}
```

Times come back from the backend in UTC (`...+00:00`), so format them for display with
`timeZone: 'America/New_York'`, e.g.
`new Date(t).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })`.

## Backend calls

Every call returns `{ data, error }`. If `error` is set, `error.message` is a sentence you can
show the user as-is.

### Libraries and rooms

```js
const { data } = await supabase.from('locations').select('id, name').order('id')
// [{ id: 1, name: 'Main Library' }, { id: 2, name: 'McBay Science Library' }, ...]

const { data } = await supabase.from('rooms').select('id, location_id, name, capacity, students_only')
```

There are 5 libraries and 153 rooms. Ignore the `rooms.sensor_id` column (unused).

### Club dropdown

```js
const { data } = await supabase.rpc('get_organizations')
// [{ id: 4, name: 'Accounting Society' }, ...]  (names only, never access codes)
```

### Search free rooms

```js
const { data, error } = await supabase.rpc('get_available_rooms', {
  p_location_id: 1,
  p_start: '2026-11-03T18:00:00-05:00',
  p_end: '2026-11-03T19:00:00-05:00',
  p_group_size: 4,
  p_booking_type: 'student',   // 'student' | 'club' | 'professional_club'
})
// data: [{ id, location_id, name, capacity, room_type, would_bump }]
```

`would_bump: true` means booking it replaces a lower-priority booking (the other person is emailed).
The frontend can't tell whether a club is regular or professional, so search clubs with `'club'`.
The real priority is checked when booking.

### Busy times for one room

```js
const { data } = await supabase.rpc('get_room_schedule', {
  p_room_id: 5, p_from: '2026-11-03T00:00:00-05:00', p_to: '2026-11-04T00:00:00-05:00',
})
// [{ start_time, end_time, booking_type }]  (no names or emails)
```

### Book a room

```js
const { data: code, error } = await supabase.rpc('create_booking', {
  p_room_id: 5,
  p_start: '2026-11-03T18:00:00-05:00',
  p_end: '2026-11-03T19:00:00-05:00',
  p_group_size: 4,
  p_name: 'Alex',
  p_email: 'alex@uga.edu',
  // clubs only:
  p_org_id: 9,
  p_org_code: 'a1b2c3d4',
})
// code: 6-character booking code, e.g. 'f3a9c1'
```

Show the booking code clearly. It's the student's receipt, and they need it with their email
to check in, cancel or rebook. There are no accounts or logins.

### Look up a booking

```js
const { data } = await supabase.rpc('get_booking_status', { p_code: 'f3a9c1', p_email: 'alex@uga.edu' })
// data: [] if not found, otherwise one row:
// [{ status, room_name, start_time, end_time, group_size, booker_name, checked_in_at }]
```

| `status` | Meaning | What to offer |
|---|---|---|
| `active` | Confirmed | Before start: **Cancel**. From start: **Check in** (until checked in) |
| `bumped` | A higher-priority group took the room | Alternatives to rebook (below) |
| `cancelled` | Cancelled by the student | Nothing |
| `released` | Nobody checked in within 15 minutes | Link to book again |

`checked_in_at` is empty until they check in.

### Check in

```js
const { data, error } = await supabase.rpc('check_in', { p_code: 'f3a9c1', p_email: 'alex@uga.edu' })
// data: check-in time. Works from the start time until 15 minutes after.
```

### Cancel

```js
const { data } = await supabase.rpc('cancel_booking', { p_code: 'f3a9c1', p_email: 'alex@uga.edu' })
// true = cancelled; false = not found, not active, or already started
```

### Alternatives after a bump

```js
const { data } = await supabase.rpc('get_bump_alternatives', { p_code: 'f3a9c1', p_email: 'alex@uga.edu' })
// [{ room_id, room_name, capacity, start_time, end_time, same_time }]
```

Same-time rooms come first, then up to 2 hours earlier/later. All are completely free. To rebook,
call `create_booking` with a row's `room_id`, `start_time`, `end_time`, plus the original group
size, name and email (and club + access code if it was a club booking).

### Chatbot

```js
const { data, error } = await supabase.functions.invoke('chatbot', {
  body: { messages: [{ role: 'user', content: 'room for 4 tomorrow at 3pm at Main Library' }] },
})
// data.reply   -> text to show
// data.rooms   -> free rooms (same shape as get_available_rooms; empty if the bot asked a question)
// data.booking -> { location_id, start, end, group_size } or null
```

Send the **whole conversation** each time: add the bot's reply as `{ role: 'assistant', content: reply }`
and the student's next message as a new `user` message. When the student taps a room, call
`create_booking` with that room's `id` and `data.booking.start`, `.end`, `.group_size`.
The chatbot always searches as a student.

## Common error messages

All of these come back in `error.message`. You don't need to recreate the checks in the UI.

- Please enter your name / Please enter a valid email
- Group size must be at least 1 / Group is larger than room capacity (4)
- End time must be after start time
- Times must be on the hour or at :15, :30 or :45
- Start time is in the past / Rooms can be booked up to 14 days ahead
- Bookings are limited to 2 hours
- You already have a booking that day. Cancel it first to book a different room.
- That room is already booked for that time
- Invalid organization or access code
- Clubs can book this room only from 6 PM on weekdays or on weekends
- No booking found with that code and email
- Check-in opens at the start of your booking / Check-in closed 15 minutes after the start time
- This booking was released because nobody checked in within 15 minutes

## Automatic emails (nothing to build)

The backend emails people automatically when their booking is **bumped**, when it **starts**
(a check-in reminder), and when it's **released**. For the demo, all emails go to one team
inbox rather than real students.

## Things to leave alone

- `database/schema.sql` and `supabase/functions/`: backend, owned by Praneeth.
- Function names and inputs above: if a screen needs something the backend doesn't
  provide yet (a new field, a new filter), ask Praneeth rather than working around it.

## Testing tips

- Each test booking on the same day needs a different email (one booking per email per day).
- To test as a club, ask Praneeth for an access code (they're secret and not in this repo).
- Bookings you make are real. Ask Praneeth to clear test bookings when you're done.
