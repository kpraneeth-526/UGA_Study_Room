

-- ===== 1. Base tables and sample data =====
create extension if not exists btree_gist;

create table locations (
  id bigint generated always as identity primary key,
  name text not null
);

create table rooms (
  id bigint generated always as identity primary key,
  location_id bigint references locations(id) on delete cascade,
  name text not null,
  capacity int not null,
  room_type text not null default 'study' check (room_type in ('study','classroom')),
  sensor_id text
);

create table bookings (
  id bigint generated always as identity primary key,
  room_id bigint references rooms(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  group_size int not null,
  booker_name text not null,
  booker_email text not null,
  booking_type text not null default 'student' check (booking_type in ('student','club','class')),
  booking_code text not null default substr(md5(random()::text), 1, 6),
  check (end_time > start_time),
  exclude using gist (room_id with =, tstzrange(start_time, end_time) with &&)
);

insert into locations (name) values ('Main Library'), ('Science Library');

insert into rooms (location_id, name, capacity, room_type) values
  (1, 'Study Room 101', 4, 'study'),
  (1, 'Study Room 102', 6, 'study'),
  (2, 'Study Room A', 8, 'study'),
  (2, 'Classroom 200', 30, 'classroom');

-- ===== 2. Extra columns and sensor table =====
alter table bookings add column organization_name text;
alter table bookings add constraint booking_code_unique unique (booking_code);

create table sensor_readings (
  id bigint generated always as identity primary key,
  room_id bigint references rooms(id) on delete cascade,
  occupied boolean not null,
  recorded_at timestamptz not null default now()
);
create index on sensor_readings (room_id, recorded_at desc);

-- ===== 3. Row Level Security (no login, so tables are locked by default) =====
alter table locations enable row level security;
alter table rooms enable row level security;
alter table bookings enable row level security;
alter table sensor_readings enable row level security;

create policy "public read locations" on locations for select using (true);
create policy "public read rooms" on rooms for select using (true);

-- ===== 4. Priority system: tables and columns =====
create table if not exists organizations (
  id bigint generated always as identity primary key,
  name text not null unique,
  org_type text not null check (org_type in ('club','professional_club')),
  access_code text not null default substr(md5(random()::text), 1, 8)
);
alter table organizations enable row level security;

alter table bookings add column if not exists status text not null default 'active'
  check (status in ('active','bumped','cancelled'));
alter table bookings add column if not exists priority int not null default 1;
alter table bookings add column if not exists org_id bigint references organizations(id);
alter table rooms add column if not exists students_only boolean not null default false;

alter table bookings drop constraint if exists bookings_booking_type_check;
alter table bookings add constraint bookings_booking_type_check
  check (booking_type in ('student','club','professional_club'));

-- replace the original overlap rule with one that only counts ACTIVE bookings
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'bookings'::regclass and contype = 'x' loop
    execute format('alter table bookings drop constraint %I', c);
  end loop;
end $$;

alter table bookings add constraint no_overlap
  exclude using gist (room_id with =, tstzrange(start_time, end_time) with &&)
  where (status = 'active');

-- study rooms holding 8 or fewer people are students-only
update rooms set students_only = (room_type = 'study' and capacity <= 8);

-- ===== 5. Functions (the only way the app reads bookings or writes them) =====
drop function if exists get_available_rooms(bigint, timestamptz, timestamptz, int, text);
drop function if exists create_booking(bigint, timestamptz, timestamptz, int, text, text, text, text);
drop function if exists create_booking(bigint, timestamptz, timestamptz, int, text, text, bigint, text);
drop function if exists get_room_schedule(bigint, timestamptz, timestamptz);
drop function if exists cancel_booking(text, text);

-- Priority: student 1, club 2, professional club 3
create or replace function booking_priority(p_type text) returns int
language sql immutable as $$
  select case p_type when 'student' then 1 when 'club' then 2 else 3 end;
$$;

-- Club dropdown (names only, never access codes)
create or replace function get_organizations()
returns table (id bigint, name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name from organizations o order by o.name;
$$;

-- Rooms free for a time window. would_bump = a lower-priority booking is in the way.
create or replace function get_available_rooms(
  p_location_id bigint, p_start timestamptz, p_end timestamptz,
  p_group_size int, p_booking_type text default 'student')
returns table (id bigint, location_id bigint, name text, capacity int,
               room_type text, would_bump boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.location_id, r.name, r.capacity, r.room_type,
    exists (select 1 from bookings b
            where b.room_id = r.id and b.status = 'active'
              and tstzrange(b.start_time, b.end_time) && tstzrange(p_start, p_end)) as would_bump
  from rooms r
  where r.location_id = p_location_id
    and r.capacity >= p_group_size
    and (case when p_booking_type = 'student'
              then r.room_type = 'study'
              else not r.students_only end)
    and not exists (
      select 1 from bookings b
      where b.room_id = r.id and b.status = 'active'
        and tstzrange(b.start_time, b.end_time) && tstzrange(p_start, p_end)
        and (b.priority >= booking_priority(p_booking_type) or b.start_time <= now()))
  order by r.capacity, r.name;
$$;

-- Busy times for one room (no names or emails exposed)
create or replace function get_room_schedule(
  p_room_id bigint, p_from timestamptz, p_to timestamptz)
returns table (start_time timestamptz, end_time timestamptz, booking_type text)
language sql stable security definer set search_path = public as $$
  select b.start_time, b.end_time, b.booking_type from bookings b
  where b.room_id = p_room_id and b.status = 'active'
    and b.start_time < p_to and b.end_time > p_from
  order by b.start_time;
$$;

-- Make a booking (students leave p_org_id and p_org_code empty)
create or replace function create_booking(
  p_room_id bigint, p_start timestamptz, p_end timestamptz, p_group_size int,
  p_name text, p_email text, p_org_id bigint default null, p_org_code text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_org organizations%rowtype;
  v_type text := 'student';
  v_priority int;
  v_code text;
begin
  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'Room not found'; end if;
  if p_email not like '%@%' then raise exception 'Please enter a valid email'; end if;
  if p_start < now() - interval '5 minutes' then raise exception 'Start time is in the past'; end if;
  if p_group_size > v_room.capacity then
    raise exception 'Group is larger than room capacity (%)', v_room.capacity; end if;
  if p_end - p_start > interval '2 hours' then
    raise exception 'Bookings are limited to 2 hours'; end if;

  if p_org_id is not null then
    select * into v_org from organizations where id = p_org_id;
    if not found or v_org.access_code <> coalesce(p_org_code, '') then
      raise exception 'Invalid organization or access code'; end if;
    v_type := v_org.org_type;
    if v_room.students_only then
      raise exception 'This room is reserved for students'; end if;
  else
    if v_room.room_type <> 'study' then
      raise exception 'Students can only book study rooms'; end if;
  end if;

  v_priority := booking_priority(v_type);

  -- blocked by an equal/higher priority booking, or one that already started
  if exists (select 1 from bookings b
             where b.room_id = p_room_id and b.status = 'active'
               and tstzrange(b.start_time, b.end_time) && tstzrange(p_start, p_end)
               and (b.priority >= v_priority or b.start_time <= now())) then
    raise exception 'That room is already booked for that time'; end if;

  -- bump any lower-priority bookings in the way
  update bookings set status = 'bumped'
  where room_id = p_room_id and status = 'active'
    and tstzrange(start_time, end_time) && tstzrange(p_start, p_end);

  insert into bookings (room_id, start_time, end_time, group_size, booker_name,
                        booker_email, booking_type, priority, org_id, organization_name)
  values (p_room_id, p_start, p_end, p_group_size, p_name, p_email,
          v_type, v_priority, v_org.id, v_org.name)
  returning booking_code into v_code;
  return v_code;
exception when exclusion_violation then
  raise exception 'That room is already booked for that time';
end; $$;

-- Cancel (needs booking code + email; only future active bookings)
create or replace function cancel_booking(p_code text, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update bookings set status = 'cancelled'
  where booking_code = p_code and lower(booker_email) = lower(p_email)
    and status = 'active' and start_time > now();
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;

-- ===== 6. Sample clubs and a larger room for testing =====
insert into rooms (location_id, name, capacity, room_type, students_only)
select 1, 'Group Study Hall', 12, 'study', false
where not exists (select 1 from rooms where name = 'Group Study Hall');

insert into organizations (name, org_type) values
  ('Chess Club', 'club'),
  ('Pre-Law Professional Fraternity', 'professional_club')
on conflict (name) do nothing;

-- ===== 7. Bump notifications (option A) =====
-- Sending is done by the Edge Function in supabase/functions/send-bump-email,
-- triggered by a Database Webhook set up in the dashboard (not in this file):
--   Integrations > Database Webhooks > send_bump_email
--   table notifications, event Insert, Supabase Edge Function send-bump-email,
--   timeout 5000, header x-webhook-secret = the WEBHOOK_SECRET Edge Function secret.
-- Edge Function "Verify JWT" is turned off; the function checks x-webhook-secret instead.
create table if not exists notifications (
  id bigint generated always as identity primary key,
  booking_id bigint references bookings(id) on delete cascade,
  kind text not null default 'bumped',
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table notifications enable row level security;

create or replace function queue_bump_notification()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_room text;
begin
  select name into v_room from rooms where id = new.room_id;
  insert into notifications (booking_id, kind, to_email, subject, body)
  values (
    new.id, 'bumped', new.booker_email,
    'Your study room booking was bumped',
    'Hi ' || new.booker_name || ', your booking for ' || v_room || ' on ' ||
    to_char(new.start_time at time zone 'America/New_York', 'Dy Mon DD, HH12:MI AM') ||
    ' was given to a higher-priority group. Booking code: ' || new.booking_code ||
    '. Open the app and enter your code to pick a new room.'
  );
  return new;
end; $$;

drop trigger if exists bump_notify on bookings;
create trigger bump_notify
after update of status on bookings
for each row
when (old.status = 'active' and new.status = 'bumped')
execute function queue_bump_notification();

-- ===== 8. Booking status and alternatives for bumped bookings (option C) =====
drop function if exists get_booking_status(text, text);

create or replace function get_booking_status(p_code text, p_email text)
returns table (status text, room_name text, start_time timestamptz,
               end_time timestamptz, group_size int, booker_name text)
language sql stable security definer set search_path = public as $$
  select b.status, r.name, b.start_time, b.end_time, b.group_size, b.booker_name
  from bookings b join rooms r on r.id = b.room_id
  where b.booking_code = p_code and lower(b.booker_email) = lower(p_email);
$$;

-- Free alternatives for a bumped booking: same time first, then +/- 2 hours
create or replace function get_bump_alternatives(p_code text, p_email text)
returns table (room_id bigint, room_name text, capacity int,
               start_time timestamptz, end_time timestamptz, same_time boolean)
language sql stable security definer set search_path = public as $$
  with orig as (
    select b.start_time, b.end_time, b.group_size, b.booking_type, r.location_id
    from bookings b join rooms r on r.id = b.room_id
    where b.booking_code = p_code
      and lower(b.booker_email) = lower(p_email)
      and b.status = 'bumped'
  ),
  shifts as (select generate_series(-2, 2) as h)
  select r.id, r.name, r.capacity,
         o.start_time + make_interval(hours => s.h),
         o.end_time + make_interval(hours => s.h),
         s.h = 0
  from orig o
  cross join shifts s
  join rooms r on r.location_id = o.location_id
  where r.capacity >= o.group_size
    and (case when o.booking_type = 'student'
              then r.room_type = 'study'
              else not r.students_only end)
    and o.start_time + make_interval(hours => s.h) > now()
    and not exists (
      select 1 from bookings x
      where x.room_id = r.id and x.status = 'active'
        and tstzrange(x.start_time, x.end_time) &&
            tstzrange(o.start_time + make_interval(hours => s.h),
                      o.end_time + make_interval(hours => s.h)))
  order by (s.h <> 0), abs(s.h), r.capacity, r.name;
$$;