import { useState } from 'react';
import { roomNumber } from './floorMaps';
import { prettyTime } from './time';
import './floor-map.css';

// Floor buttons (with free-room counts) above the map of the chosen floor.
// Used by both the homepage finder and the Library Explorer.
export function FloorMaps({ floors, rooms, window, loading, onReserve }) {
  const [floorIndex, setFloorIndex] = useState(0);
  const floor = floors[floorIndex] || floors[0];
  const freeNumbers = new Set((rooms || []).map((room) => roomNumber(room.name)));

  return (
    <>
      {floors.length > 1 && (
        <div className="floor-tabs" role="group" aria-label="Floor">
          {floors.map((each, index) => (
            <button key={each.floor} type="button" aria-pressed={each === floor}
              onClick={() => setFloorIndex(index)}>
              {each.floor}
              {rooms && <span>{each.rooms.filter((spot) => freeNumbers.has(spot.number)).length} free</span>}
            </button>
          ))}
        </div>
      )}
      <FloorMap key={floor.image} floor={floor} rooms={rooms} window={window}
        loading={loading} onReserve={onReserve} />
    </>
  );
}

// Draws a floor plan with a clickable box over each study room.
// rooms: the search results, or null while the first search runs or after a failed one.
export default function FloorMap({ floor, rooms, window, loading, onReserve }) {
  const [hovered, setHovered] = useState(null);

  const free = new Map((rooms || []).map((room) => [roomNumber(room.name), room]));
  const statusOf = (number) => (rooms === null ? 'idle' : free.has(number) ? 'free' : 'busy');
  const freeCount = floor.rooms.filter((spot) => free.has(spot.number)).length;

  function choose(spot) {
    if (statusOf(spot.number) === 'free') onReserve(free.get(spot.number));
  }

  const active = floor.rooms.find((spot) => spot.number === hovered);
  const title = (spot) => spot.label || `Room ${spot.number}`;
  // rooms near the top edge show their tooltip below; rooms near the sides keep it on the map
  const below = active && active.box[1] / floor.height < 0.15;
  const tipLeft = active && Math.min(88, Math.max(12, ((active.box[0] + active.box[2] / 2) / floor.width) * 100));
  const tipTop = active && ((below ? active.box[1] + active.box[3] : active.box[1]) / floor.height) * 100;

  return (
    <div className="floor-map">
      <div className="floor-map-header">
        <h3>{floor.floor}</h3>
        <p>
          {rooms === null
            ? `${floor.rooms.length} study rooms on this floor`
            : `${freeCount} of ${floor.rooms.length} rooms free on this floor`}
        </p>
      </div>

      <ul className="floor-map-legend">
        <li><span className="swatch free" /> Free, click to reserve</li>
        <li><span className="swatch busy" /> Booked or too small</li>
      </ul>

      <div className="floor-map-canvas">
        <svg viewBox={`0 0 ${floor.width} ${floor.height}`} role="group"
          aria-label={`${floor.floor} map`}>
          <image href={floor.image} width={floor.width} height={floor.height} />
          {floor.rooms.map((spot) => {
            const status = statusOf(spot.number);
            const [x, y, w, h] = spot.box;
            return (
              <rect key={spot.number} x={x} y={y} width={w} height={h}
                className={`floor-room ${status}${hovered === spot.number ? ' hovered' : ''}`}
                tabIndex={0}
                role="button"
                aria-disabled={status !== 'free'}
                aria-label={`${title(spot)}, ${status === 'free' ? 'free' : status === 'busy' ? 'not available' : 'checking availability'}`}
                onMouseEnter={() => setHovered(spot.number)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(spot.number)}
                onBlur={() => setHovered(null)}
                onClick={() => choose(spot)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    choose(spot);
                  }
                }} />
            );
          })}
        </svg>

        {active && (
          <div className={`floor-map-tip${below ? ' below' : ''}`} style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}>
            <strong>{title(active)}</strong>
            {statusOf(active.number) === 'idle' && (
              <span>{loading ? 'Checking availability…' : 'Change the search above to check this room'}</span>
            )}
            {statusOf(active.number) === 'busy' && <span>Not available for this time or group size</span>}
            {statusOf(active.number) === 'free' && (
              <>
                <span>Up to {free.get(active.number).capacity} people</span>
                {window && <span>Free {prettyTime(window.start)} – {prettyTime(window.end)}</span>}
                <em>Click to reserve ↗</em>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
