-- ===== 2. Extra tables (recurring_classes, sensor_readings) =====
-- Extra columns on bookings
alter table bookings add column organization_name text;
alter table bookings add constraint booking_code_unique unique (booking_code);

-- Professor semester schedules (we'll generate bookings from this in Week 3)
create table recurring_classes (
  id bigint generated always as identity primary key,
  room_id bigint references rooms(id) on delete cascade,
  professor_name text not null,
  course_name text not null,
  days_of_week int[] not null,       -- 1=Mon, 2=Tue ... 7=Sun
  start_time time not null,
  end_time time not null,
  semester_start date not null,
  semester_end date not null,
  check (end_time > start_time)
);

-- Motion sensor data
create table sensor_readings (
  id bigint generated always as identity primary key,
  room_id bigint references rooms(id) on delete cascade,
  occupied boolean not null,
  recorded_at timestamptz not null default now()
);
create index on sensor_readings (room_id, recorded_at desc);


-- ===== 3. Row Level Security and read policies =====
alter table locations enable row level security;
alter table rooms enable row level security;
alter table bookings enable row level security;
alter table recurring_classes enable row level security;
alter table sensor_readings enable row level security;

-- The app may read locations and rooms. Nothing else is directly readable.
create policy "public read locations" on locations for select using (true);
create policy "public read rooms" on rooms for select using (true);

-- ===== 4. Functions =====
-- 1) Find rooms that fit the group and are free for the time window
create or replace function get_available_rooms(
  p_location_id bigint, p_start timestamptz, p_end timestamptz,
  p_group_size int, p_room_type text default 'study')
returns setof rooms
language sql stable security definer set search_path = public as $$
  select r.* from rooms r
  where r.location_id = p_location_id
    and r.room_type = p_room_type
    and r.capacity >= p_group_size
    and not exists (
      select 1 from bookings b
      where b.room_id = r.id
        and tstzrange(b.start_time, b.end_time) && tstzrange(p_start, p_end)
    )
  order by r.capacity, r.name;
$$;

-- 2) Show a room's busy times (no names or emails exposed)
create or replace function get_room_schedule(
  p_room_id bigint, p_from timestamptz, p_to timestamptz)
returns table (start_time timestamptz, end_time timestamptz, booking_type text)
language sql stable security definer set search_path = public as $$
  select b.start_time, b.end_time, b.booking_type from bookings b
  where b.room_id = p_room_id and b.start_time < p_to and b.end_time > p_from
  order by b.start_time;
$$;

-- 3) Create a booking and return the booking code
create or replace function create_booking(
  p_room_id bigint, p_start timestamptz, p_end timestamptz, p_group_size int,
  p_name text, p_email text,
  p_booking_type text default 'student', p_organization text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_code text;
begin
  select * into v_room from rooms where id = p_room_id;
  if not found then raise exception 'Room not found'; end if;
  if p_booking_type not in ('student','club') then
    raise exception 'Invalid booking type'; end if;
  if p_email not like '%@%' then raise exception 'Please enter a valid email'; end if;
  if p_start < now() - interval '5 minutes' then
    raise exception 'Start time is in the past'; end if;
  if p_group_size > v_room.capacity then
    raise exception 'Group is larger than room capacity (%)', v_room.capacity; end if;
  if p_booking_type = 'student' and v_room.room_type <> 'study' then
    raise exception 'Students can only book study rooms'; end if;
  if p_booking_type = 'club' and v_room.room_type <> 'classroom' then
    raise exception 'Clubs book classrooms through this form'; end if;
  if p_booking_type = 'student' and p_end - p_start > interval '3 hours' then
    raise exception 'Study room bookings are limited to 3 hours'; end if;

  insert into bookings (room_id, start_time, end_time, group_size,
                        booker_name, booker_email, booking_type, organization_name)
  values (p_room_id, p_start, p_end, p_group_size,
          p_name, p_email, p_booking_type, p_organization)
  returning booking_code into v_code;
  return v_code;
exception when exclusion_violation then
  raise exception 'That room is already booked for that time';
end; $$;

-- 4) Cancel with booking code + email (class bookings can't be cancelled here)
create or replace function cancel_booking(p_code text, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from bookings
  where booking_code = p_code
    and lower(booker_email) = lower(p_email)
    and booking_type <> 'class'
    and start_time > now();
  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;