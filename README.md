# UGA Study Rooms

A website for booking group study rooms at UGA libraries, with priority bookings for clubs,
check-in to free up no-show rooms, email notifications, and a chatbot that finds rooms from
a plain-English request.

- **Frontend:** React + Vite (this repo, `src/`)
- **Backend:** Supabase: database, booking rules and emails (`database/schema.sql`) and
  Edge Functions (`supabase/functions/`)

## Getting started

```
npm install
npm run dev
```

You also need a `.env.local` file with the Supabase URL and key. See the
[frontend guide](docs/FRONTEND_GUIDE.md) for setup, the booking rules, and every backend call.
