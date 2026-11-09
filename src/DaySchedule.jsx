import { useEffect, useRef, useState } from 'react';
import { configured, rpc } from './supabase';
import { dateKey, prettyTime, toInstant } from './time';
import './floor-map.css';
import './day-schedule.css';

const SLOT_MS = 30 * 60000;      // 30-minute columns
const STEP_MS = 15 * 60000;      // bookings move in 15-minute steps
const MAX_MS = 120 * 60000;      // 2-hour booking limit

// Buttons that switch between the ways of finding a room (day schedule, floor map, room search).
export function ViewTabs({ views, value, onChange }) {
  return (
    <div className="explorer-view-toggle" role="group" aria-label="Find rooms by">
      {views.map(([key, label]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// "Group Study Room 132" -> "Room 132"
const shortName = (name) => name.replace(/^Group Study /, '');

// "2026-11-08" plus n days, as "YYYY-MM-DD"
function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const longDay = (day) => new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${day}T12:00:00Z`));

// Clubs can use students-only rooms on weekends and from 6 PM on weekdays (same rule as the database).
function clubTime(start) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(start));
  const weekday = parts.find((p) => p.type === 'weekday').value;
  return weekday === 'Sat' || weekday === 'Sun' || Number(parts.find((p) => p.type === 'hour').value) >= 18;
}

// Every room in a library as a row and a whole day as 30-minute columns. Green cells are
// free; clicking one books from that time for the chosen duration (shortened if the room
// is booked sooner). The grid opens scrolled to the current time or the searched start
// time, and the arrows move between days. Give it key={date} so a new search resets the day.
// refreshKey: change it to reload after a booking changes.
export default function DaySchedule({ locationId, date, startTime, people, type, duration, refreshKey, onReserve }) {
  const [day, setDay] = useState(date);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef(null);
  const scrolledDay = useRef(null);

  const today = dateKey(new Date(now));
  const lastDay = dateKey(new Date(now + 14 * 86400000));

  // keep "past" cells current while the page stays open
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!configured) {
        setError('Connect Supabase to see the day schedule.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const rows = await rpc('get_location_schedule', {
          p_location_id: Number(locationId),
          p_from: toInstant(day, '00:00'),
          p_to: toInstant(addDays(day, 1), '00:00'),
        });
        if (active) setRooms(rows || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [locationId, day, refreshKey]);

  // columns for the whole day; counting from midnight keeps daylight-saving days correct
  let dayStart, dayEnd;
  try {
    dayStart = Date.parse(toInstant(day, '00:00'));
    dayEnd = Date.parse(toInstant(addDays(day, 1), '00:00'));
  } catch {
    dayStart = dayEnd = 0;
  }
  const starts = Array.from({ length: Math.max(0, (dayEnd - dayStart) / SLOT_MS) }, (_, i) => dayStart + i * SLOT_MS);

  // when a day first loads, scroll to now (today), the searched start time, or 8 AM
  useEffect(() => {
    if (loading || scrolledDay.current === day || !scroller.current || !starts.length) return;
    scrolledDay.current = day;
    let target = dayStart + 8 * 3600000;
    if (day === date && startTime) {
      try {
        target = Date.parse(toInstant(day, startTime));
      } catch { /* keep 8 AM */ }
    }
    if (day === today) target = Math.max(target, now);
    const slot = Math.max(0, Math.min(starts.length - 2, Math.floor((target - dayStart) / SLOT_MS)));
    const hourCell = scroller.current.querySelector(`[data-slot="${slot - (slot % 2)}"]`);
    const corner = scroller.current.querySelector('.day-grid-corner');
    if (hourCell && corner) scroller.current.scrollLeft = hourCell.offsetLeft - corner.offsetWidth;
  });

  const club = type && type !== 'student';
  const fits = rooms.filter((room) => room.capacity >= Number(people || 1));

  function cellStatus(room, ranges, start) {
    if (start < now - STEP_MS) return 'past';
    if (ranges.some(([s, e]) => s < start + SLOT_MS && e > start)) return 'busy';
    if (club && room.students_only && !clubTime(start)) return 'closed';
    return 'free';
  }

  // the booking a click would make: from this cell for the chosen duration,
  // cut short by the room's next booking, the end of the day, or the 2-hour limit
  function windowFrom(ranges, start) {
    const nextBusy = Math.min(dayEnd, ...ranges.map(([s]) => s).filter((s) => s > start));
    const end = Math.min(start + Number(duration || 60) * 60000, nextBusy, start + MAX_MS);
    const length = Math.floor((end - start) / STEP_MS) * STEP_MS;
    return { start: new Date(start).toISOString(), end: new Date(start + length).toISOString() };
  }

  return (
    <div className="day-schedule">
      <div className="day-nav">
        <h3>{longDay(day)}</h3>
        <div className="day-nav-buttons">
          <label className="day-nav-goto">
            <span>Go to date</span>
            <input type="date" value={day} min={today} max={lastDay}
              onChange={(event) => event.target.value && setDay(event.target.value)} />
          </label>
          <button type="button" aria-label="Previous day" disabled={day <= today}
            onClick={() => setDay(addDays(day, -1))}>‹</button>
          <button type="button" aria-label="Next day" disabled={day >= lastDay}
            onClick={() => setDay(addDays(day, 1))}>›</button>
        </div>
      </div>

      <div className="day-schedule-top">
        <ul className="floor-map-legend">
          <li><span className="swatch free" /> Free, click to reserve</li>
          <li><span className="swatch booked" /> Booked</li>
          <li><span className="swatch closed" /> Unavailable</li>
        </ul>
        <p className="day-schedule-hint" aria-live="polite">
          {hover
            ? `${shortName(hover.room.name)} · ${prettyTime(hover.window.start)} – ${prettyTime(hover.window.end)} · click to reserve`
            : `Scroll sideways for more times. Hover over green to preview a ${duration}-minute booking.`}
        </p>
      </div>

      {error ? (
        <p className="explorer-error">{error}</p>
      ) : loading && !rooms.length ? (
        <p className="explorer-empty">Loading the day schedule…</p>
      ) : !fits.length ? (
        <p className="explorer-empty">No rooms here fit {people} people. Try a smaller group.</p>
      ) : (
        <div className={`day-grid-scroll${loading ? ' refreshing' : ''}`} ref={scroller}>
          <div className="day-grid" style={{ '--slots': starts.length }}>
            <div className="day-grid-corner">Room</div>
            {starts.map((start, i) => i % 2 === 0 && (
              <div key={start} data-slot={i} className="day-grid-hour">
                {prettyTime(start).replace(':00', '')}
              </div>
            ))}

            {fits.map((room) => {
              const ranges = room.busy.map((b) => [Date.parse(b.start), Date.parse(b.end)]);
              return (
                <div key={room.room_id} className="day-grid-row">
                  <div className="day-grid-room">
                    {shortName(room.name)} <span>({room.capacity})</span>
                  </div>
                  {starts.map((start) => {
                    const status = cellStatus(room, ranges, start);
                    if (status !== 'free') {
                      return <div key={start} className={`day-cell ${status}`} aria-hidden="true" />;
                    }
                    const win = windowFrom(ranges, start);
                    const preview = hover && hover.room.room_id === room.room_id &&
                      start >= Date.parse(hover.window.start) && start < Date.parse(hover.window.end);
                    return (
                      <button key={start} type="button"
                        className={`day-cell free${preview ? ' preview' : ''}`}
                        aria-label={`${shortName(room.name)}, ${prettyTime(win.start)} to ${prettyTime(win.end)}, free`}
                        onMouseEnter={() => setHover({ room, window: win })}
                        onFocus={() => setHover({ room, window: win })}
                        onMouseLeave={() => setHover(null)}
                        onBlur={() => setHover(null)}
                        onClick={() => onReserve({ id: room.room_id, name: room.name, capacity: room.capacity }, win)} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
