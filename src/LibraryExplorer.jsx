import { useEffect, useRef, useState } from 'react';
import { rpc } from './supabase';
import RoomIllustration from "./RoomIllustration";
import { FloorMaps } from './FloorMap';
import DaySchedule, { ViewTabs } from './DaySchedule';
import { FLOOR_MAPS, roomNumber } from './floorMaps';
import { dateKey, initialSearch, searchWindow, prettyTime } from './time';
import './library-explorer.css';

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120];

export default function LibraryExplorer({ location, onBack, onReserve, onManage, refreshKey }) {
  const [filters, setFilters] = useState(() => ({
    ...initialSearch(),
    location: String(location.id),
    type: 'student',
  }));
  const [rooms, setRooms] = useState([]);
  const [window, setWindow] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latestRequest = useRef(0);
  const floors = FLOOR_MAPS[location.name] || [];
  const [view, setView] = useState('day');
  const views = [['day', 'Day schedule'], ...(floors.length ? [['map', 'Floor map']] : []), ['list', 'Room search']];
  const showDay = view === 'day';
  const showMap = floors.length > 0 && view === 'map';
  const showList = !showDay && !showMap;

  // the day schedule passes its own time window; the map and list use the searched one
  function reserve(room, win = window) {
    onReserve(room, win, {
      ...filters,
      location: String(location.id),
      type: 'student',
    });
  }

  function update(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  // Old results stay on screen while a new search runs; a slower, older
  // response is ignored so it can't overwrite a newer one.
  async function findRooms(query) {
    const request = ++latestRequest.current;
    setLoading(true);
    setError('');

    try {
      const selectedWindow = searchWindow(query);
      const data = await rpc('get_available_rooms', {
        p_location_id: Number(location.id),
        p_start: selectedWindow.start,
        p_end: selectedWindow.end,
        p_group_size: Number(query.people),
        p_booking_type: 'student',
      });
      if (request !== latestRequest.current) return;
      setWindow(selectedWindow);
      setRooms(data || []);
      setSearched(true);
    } catch (err) {
      if (request !== latestRequest.current) return;
      setError(err.message || 'Unable to load rooms. Please try again.');
      setRooms([]);
      setSearched(false);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }

  // check availability when the page opens and shortly after any filter changes
  useEffect(() => {
    const timer = setTimeout(() => findRooms(filters), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, location.id, refreshKey]);

  return (
    <section className="library-explorer section" id="library-explorer" aria-labelledby="explorer-title">
      <div className="explorer-topline">
        <button className="explorer-back" type="button" onClick={onBack}>← All libraries</button>
        <div className="explorer-topline-right">
          <span>STUDY SPACE / LIBRARY EXPLORER</span>
          <button className="explorer-manage" type="button" onClick={onManage}>My booking ↗</button>
        </div>
      </div>

      <div className="explorer-heading">
        <div>
          <span className="explorer-eyebrow">FIND YOUR NEXT FAVORITE CORNER</span>
          <h2 id="explorer-title">{location.name}<span className="explorer-dot">.</span></h2>
          <p>Find a time that works for you, then explore the spaces available to reserve.</p>
        </div>
        <div className="explorer-mark" aria-hidden="true">✳</div>
      </div>

      <form className="explorer-filters" onSubmit={(event) => {
        event.preventDefault();
        findRooms(filters);
      }}>
        <label>
          <span>Date</span>
          <input type="date" required value={filters.date} min={dateKey()}
            max={dateKey(new Date(Date.now() + 14 * 86400000))}
            onChange={(event) => update('date', event.target.value)} />
        </label>
        <label>
          <span>Start time</span>
          <input type="time" required step="900" value={filters.time}
            onChange={(event) => update('time', event.target.value)} />
        </label>
        <label>
          <span>Duration</span>
          <select value={filters.duration} onChange={(event) => update('duration', event.target.value)}>
            {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>
              {minutes < 60 ? `${minutes} min` : minutes === 60 ? '1 hour' : minutes === 120 ? '2 hours' : `${minutes} min`}
            </option>)}
          </select>
        </label>
        <label>
          <span>People</span>
          <input type="number" min="1" max="1000" required value={filters.people}
            onChange={(event) => update('people', event.target.value)} />
        </label>
        <button className="explorer-search" type="submit" disabled={loading}>
            {loading ? "Finding rooms..." : "Find available rooms ↗"}
        </button>

    </form>

    <div className="explorer-results">
      <ViewTabs views={views} value={view} onChange={setView} />

      {showDay && (
        <DaySchedule key={filters.date + filters.time} locationId={location.id} date={filters.date}
          startTime={filters.time} people={filters.people}
          type="student" duration={filters.duration} refreshKey={refreshKey} onReserve={reserve} />
      )}

      {!showDay && error && (
        <p role="alert" className="explorer-error">
          {error}
        </p>
      )}

      {showMap && (
        <FloorMaps key={location.name} floors={floors} rooms={searched ? rooms : null}
          window={window} loading={loading} onReserve={reserve} />
      )}

      {showList && !searched && !loading && !error && (
        <p className="explorer-empty">
          Choose your date and time to discover available study rooms.
        </p>
      )}

      {showList && loading && !searched && (
        <p className="explorer-empty">
          Finding available rooms...
        </p>
      )}

      {showList && searched && (
        <>
          <div className="explorer-results-heading">
            <h3>Available rooms</h3>
            <p>
              {rooms.length} {rooms.length === 1 ? "room" : "rooms"} found
            </p>
          </div>

          {rooms.length === 0 ? (
            <p className="explorer-empty">
              No rooms are available at this time. Try another time or date.
            </p>
          ) : (
            <div className="explorer-room-grid">
              {rooms.map((room, index) => (
                <article className="explorer-room-card" key={room.id}>
                    <div className="explorer-room-visual">
                        <RoomIllustration variant={index} />

                        <span className="explorer-room-number">
                            {/^\d/.test(roomNumber(room.name)) ? `ROOM ${roomNumber(room.name)}` : room.name}
                        </span>
                    </div>

                  <div className="explorer-room-info">
                    <h4>{room.name}</h4>
                    <p>Up to {room.capacity} people</p>

                    {window && (
                      <p>
                        {prettyTime(window.start)} –{" "}
                        {prettyTime(window.end)}
                      </p>
                    )}

                    <button
                      type="button"
                      className="explorer-reserve"
                      onClick={() => reserve(room)}
                    >
                      Reserve this room ↗
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  </section>
  );
}
