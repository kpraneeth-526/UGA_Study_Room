-- query 1  

-- Remove old test bookings (they'd conflict with the new rules)
delete from bookings;

-- Professors aren't part of this app, so drop that table
drop table if exists recurring_classes;

-- Clubs
create table if not exists organizations (
  id bigint generated always as identity primary key,
  name text not null unique,
  org_type text not null check (org_type in ('club','professional_club')),
  access_code text not null default substr(md5(random()::text), 1, 8)
);
alter table organizations enable row level security;

-- New columns
alter table bookings add column if not exists status text not null default 'active'
  check (status in ('active','bumped','cancelled'));
alter table bookings add column if not exists priority int not null default 1;
alter table bookings add column if not exists org_id bigint references organizations(id);
alter table rooms add column if not exists students_only boolean not null default false;

-- Booking types: student, club, professional_club
alter table bookings drop constraint if exists bookings_booking_type_check;
alter table bookings add constraint bookings_booking_type_check
  check (booking_type in ('student','club','professional_club'));

-- Replace the old double-booking rule with one that only counts active bookings
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

-- Study rooms that hold 8 or fewer people are students-only
update rooms set students_only = (room_type = 'study' and capacity <= 8);



-- querry 2
-- Remove old versions
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

-- Club dropdown (names only, never codes)
create or replace function get_organizations()
returns table (id bigint, name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name from organizations o order by o.name;
$$;

-- Rooms free for a time window
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

-- Busy times for one room
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

  if exists (select 1 from bookings b
             where b.room_id = p_room_id and b.status = 'active'
               and tstzrange(b.start_time, b.end_time) && tstzrange(p_start, p_end)
               and (b.priority >= v_priority or b.start_time <= now())) then
    raise exception 'That room is already booked for that time'; end if;

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

-- Cancel a booking
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

-- Check if a booking was bumped
create or replace function get_booking_status(p_code text, p_email text)
returns table (status text, room_name text, start_time timestamptz, end_time timestamptz)
language sql stable security definer set search_path = public as $$
  select b.status, r.name, b.start_time, b.end_time
  from bookings b join rooms r on r.id = b.room_id
  where b.booking_code = p_code and lower(b.booker_email) = lower(p_email);
$$;