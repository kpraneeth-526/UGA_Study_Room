# Study Space

A responsive React + Vite frontend for the supplied UGA study-room Supabase backend. Visuvate-inspired typography, space, movement and interaction; original layout, illustrations and copy.

## Start locally

Use Node.js 22.12+ (or a newer supported release).

1. Extract this project and open a terminal in its folder.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local`.
4. Enter your Supabase project URL and **public anon/publishable key**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-key
```

Never put a service-role/secret key in a VITE_ variable. Vite exposes these values to the browser.

5. Run `npm run dev` and open the URL printed in the terminal.
6. Restart the dev server after changing environment values.

Without both environment values, the app deliberately runs a labeled design preview. Sample room listings are illustrative; bookings and lookup are disabled. Invalid configured credentials show errors, not fake room availability. The app does not persist names, emails, access codes or booking codes to localStorage.

`preview.html` is an additional standalone design preview. Its interactive mode uses React 18.3.1 from jsDelivr and therefore needs internet access; its initial visual layout also displays offline. It contains no database credentials and cannot create reservations. The actual Vite app uses the dependencies in package.json, including the supplied React version.

## Connect the existing backend

The app expects your original schema to already be installed in Supabase. The supplied `backend/schema.sql` is an unmodified reference copy. **Do not blindly rerun it on an existing database: section 9 truncates bookings and other tables.** Nothing in this deliverable has been applied to your Supabase project.

| Frontend flow | Backend operation |
| --- | --- |
| Location selector | SELECT id,name FROM locations |
| Organization selector | get_organizations() |
| Room search | get_available_rooms(p_location_id,p_start,p_end,p_group_size,p_booking_type) |
| Daily busy times | get_room_schedule(p_room_id,p_from,p_to) |
| Reserve | create_booking(p_room_id,p_start,p_end,p_group_size,p_name,p_email,p_org_id,p_org_code) |
| Lookup | get_booking_status(p_code,p_email) |
| Cancel | cancel_booking(p_code,p_email) |
| Check in | check_in(p_code,p_email) |
| Bumped alternatives | get_bump_alternatives(p_code,p_email) |

The booking RPC determines the actual organization type and priority from its access code. The search type does not grant priority. Alternate bookings ask the user to select student/organization because get_booking_status does not return the original organization credentials or booking type. Alternative availability is rechecked by create_booking when submitting.

Only read-only functions run on initial load/search. Writes happen on explicit form submissions. Booking confirmation shows the returned code; it does not claim an email was delivered. Existing backend privacy rules keep other bookers' details out of schedules.

## Files

- `src/App.jsx`: original illustrations, page sections, finder and reservation dialogs.
- `src/App.css`: responsive design, hover/reveal/floating animations and reduced-motion support.
- `src/supabase.js`: guarded client initialization and RPC/error wrapper.
- `src/time.js`: Eastern-time conversion, quarter-hour defaults and date formatting.
- `src/demo.js`: explicitly labeled preview fixtures.
- `tests/time.test.js`: timezone, DST, date-boundary and booking-window tests.
- `backend/schema.sql`: your original backend reference.

## Validation

Run `npm test` for timezone tests; `npm run build` for the production bundle; `npm run lint` for Oxlint. Local source parsing and RPC argument checks were performed during generation. Package installation and Chromium downloads were blocked by network policy in the generation workspace, so a full Vite build and browser layout/interaction test could not be completed there. No live database tests were possible without project credentials.

Before deployment, test with your own non-production Supabase data:

1. Search as a student and reserve a room. Save the returned code.
2. Look up the booking using the same email and code.
3. Cancel a future booking and verify it disappears from the schedule.
4. Reserve a current valid slot and check in during the allowed grace period.
5. Test club credentials, student-only rooms, priority bumping, and alternatives.
6. Check expired check-in, invalid credentials, one-booking-per-day, and overlapping-booking errors.
7. Check mobile widths, keyboard focus, Escape/close behavior, and reduced motion.

## Backend features not available through the supplied frontend API

- Sensor readings: the table is locked by RLS and no public latest-occupancy function was supplied. The UI does not fabricate live occupancy.
- Notifications: the existing SQL queues them, but the email Edge Function and webhook are not included. Email delivery must be configured separately.
- Automatic release: the SQL cron job remains responsible for no-shows, independent of whether the frontend is open.
- Building hours: the conversation's proposed hours/closures migration was not provided or applied. This frontend does not claim to enforce building opening hours. Add that check to the database before treating it as an enforced rule.
- UGA integration: this is an independent student project; it does not write to UGA's official reservation system. The UI discloses this in its FAQ.
- Existing room seed names/capacities are taken as supplied; illustrations are not actual room photographs.

## Deployment

Run `npm run build`; deploy `dist/` to a static host. Set the same two public environment variables on the host before building. No client-side route rewrite is needed because navigation uses page anchors and dialogs. Rebuild after environment changes.
