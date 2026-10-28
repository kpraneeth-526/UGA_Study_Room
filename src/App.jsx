import { useEffect, useRef, useState } from "react";
import LibraryGallery from "./LibraryGallery";
import LibraryExplorer from "./LibraryExplorer";
import { configured, getLocations, rpc, supabase } from "./supabase";
import { demoLocations, demoRooms } from "./demo";
import {
  dateKey,
  clockKey,
  prettyDay,
  prettyTime,
  initialSearch,
  searchWindow,
  toInstant,
} from "./time";

function Icon({ name = "arrow", size = 20, ...props }) {
  const paths = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    up: "M6 18 18 6M6 6h12v12",
    pin: "M12 21s7-6 7-13a7 7 0 0 0-14 0c0 7 7 13 7 13Z M14 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M20 21v-3a4 4 0 0 0-3-3M17 3a4 4 0 0 1 0 8",
    check: "m5 12 4 4L19 6",
    close: "m6 6 12 12M6 18 18 6",
    book: "M3 4h6l3 3 3-3h6v16h-6l-3 2-3-2H3ZM12 7v15",
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
function Logo() {
  return (
    <a className="logo" href="#home" aria-label="Study Space home">
      <img className="brand-icon" src="/favicon.svg" alt="" />
      <span className="logo-study">study</span>
      <span className="logo-space">space</span>
    </a>
  );
}
function RoomArt({ variant = 0, hero = false }) {
  const colors = [
    ["#d6b783", "#fff0ca", "#6f1d1b"],
    ["#d5b27e", "#ffe6a7", "#99582a"],
    ["#e4c599", "#fff0ca", "#6f1d1b"],
  ][variant % 3];
  return (
    <svg
      className={hero ? "room-art hero-art" : "room-art"}
      viewBox="0 0 600 440"
      role="img"
      aria-label="Illustration of a bright study space, not a photograph of a specific room"
    >
      <ellipse
        cx="310"
        cy="367"
        rx="226"
        ry="44"
        fill="#432818"
        opacity=".06"
      />
      <path d="m65 270 235 130 238-136-233-130Z" fill={colors[0]} />
      <path d="M65 270V95l240 135v170Z" fill={colors[1]} />
      <path d="M305 400V230L538 95v169Z" fill={colors[0]} />
      <path d="M65 95 300 30l238 65-233 135Z" fill="#fffaf0" opacity="0" />
      <path d="m334 245 168-98v96l-168 97Z" fill="#fffaf0" />
      <path
        d="m390 213 0 98m56-130v98m-112 9 168-98"
        stroke={colors[0]}
        strokeWidth="6"
      />
      <path d="m334 340 168-97 36 21-167 97Z" fill="#fffaf0" opacity=".28" />
      <path d="m90 148 82 46v68l-82-46Z" fill="#6f1d1b" />
      <path d="m102 171 58 32v42l-58-32Z" fill="#ffe6a7" />
      <path
        d="m112 208 15-13 16 27 15-6"
        stroke="#99582a"
        strokeWidth="3"
        fill="none"
      />
      <path d="m155 262 151-88 150 85-151 88Z" fill="#bb9457" />
      <path d="m155 262 150 85 151-88v12l-151 88-150-86Z" fill="#99582a" />
      <path
        d="M174 282v61m114 11v34m148-111v53"
        stroke="#432818"
        strokeWidth="10"
      />
      <g className="art-book">
        <path d="m254 249 44-25 41 24-44 25Z" fill="#fff6df" />
        <path d="m254 249 41 24v6l-41-24Z" fill="#bb9457" />
        <path d="m270 234 29-16 30 17-29 16Z" fill="#6f1d1b" />
      </g>
      <path d="m346 259 24-14 26 14-25 14Z" fill="#432818" />
      <path d="m346 259-4-28 25-14 3 28Z" fill="#6f1d1b" />
      <g fill={colors[2]}>
        <path d="m165 308-39 23 45 25 39-23Z" />
        <path d="m126 331-4-49 44 25 5 49Z" />
        <path d="m370 319 41-24 43 24-41 24Z" />
        <path d="m413 343 4-49 42-25-5 50Z" />
      </g>
      <path
        d="m136 341-3 30m37-19 2 35m250-50 1 32m23-40 3 28"
        stroke="#432818"
        strokeWidth="6"
      />
      <path d="m470 259 7 40q20 12 35-3l6-38Z" fill="#bb9457" />
      <ellipse cx="494" cy="258" rx="24" ry="11" fill="#99582a" />
      <path d="M493 258v-67" stroke="#432818" strokeWidth="4" />
      <path
        d="M493 226q-45-8-33-41 35 1 33 41m0-16q35-15 30-41-37 5-30 41m0 36q35-5 39-32-35-6-39 32"
        fill="#99582a"
      />
      <path d="M260 66v70" stroke="#432818" strokeWidth="3" />
      <path d="m230 147 30-27 32 27q-31 20-62 0" fill="#ffe6a7" />
      <ellipse cx="260" cy="148" rx="29" ry="8" fill="#fff6df" />
    </svg>
  );
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <span className="eyebrow">STUDY SPACE / RESERVATIONS</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
const Message = ({ children, good = false }) =>
  children ? (
    <div
      role={good ? "status" : "alert"}
      className={`message ${good ? "good" : ""}`}
    >
      {children}
    </div>
  ) : null;
function Booking({ selection, organizations, onClose, onBooked }) {
  const { room, window: win, search } = selection;
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [org, setOrg] = useState(""),
    [code, setCode] = useState(""),
    [agree, setAgree] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState(null);
  const [bookingType, setBookingType] = useState(search.type);
  const club = bookingType !== "student";
  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const bookingCode = await rpc("create_booking", {
        p_room_id: room.id,
        p_start: win.start,
        p_end: win.end,
        p_group_size: Number(search.people),
        p_name: name.trim(),
        p_email: email.trim().toLowerCase(),
        p_org_id: club ? Number(org) : null,
        p_org_code: club ? code : null,
      });
      setConfirmation(bookingCode);
      onBooked();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={confirmation ? "Your space is reserved." : "Make it your space."}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="booking-summary">
        <span className="summary-icon">
          <Icon name={confirmation ? "check" : "book"} size={26} />
        </span>
        <div>
          <strong>{room.name}</strong>
          <p>
            {prettyDay(win.start)} · {prettyTime(win.start)}–
            {prettyTime(win.end)} ET
          </p>
          <p>
            {search.people} people ·{" "}
            {club ? "Organization reservation" : "Student reservation"}
          </p>
        </div>
      </div>
      {confirmation ? (
        <>
          <div className="confirmation">
            <span className="eyebrow">YOUR BOOKING CODE</span>
            <strong>{confirmation}</strong>
            <p>
              Save this code. You’ll need it and your email to check in or
              manage your booking.
            </p>
          </div>
          <p className="fine">
            Check in when your reservation starts, within 15 minutes. For a
            reservation made after the start time, your window starts when you
            book.
          </p>
          <button className="button full" onClick={onClose}>
            All set <Icon name="check" />
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          {selection.alternative && (
            <label>
              Reserve as
              <select
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value)}
              >
                <option value="student">Student</option>
                <option value="club">Organization</option>
              </select>
            </label>
          )}
          <label>
            Your name
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@uga.edu"
            />
          </label>
          {club && (
            <div className="form-grid">
              <label>
                Organization
                <select
                  required
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                >
                  <option value="">Choose your organization</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Organization access code
                <input
                  required
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>
          )}
          {club && (
            <p className="fine">
              Your verified organization determines your booking priority.
            </p>
          )}
          {room.would_bump && (
            <label className="checkbox">
              <input
                type="checkbox"
                required
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              I understand this reservation may displace a lower-priority group.
            </label>
          )}
          <Message>{error}</Message>
          {!configured && (
            <Message>
              This is a preview. No real reservation will be made.
            </Message>
          )}
          <button
            className="button full"
            disabled={pending || !configured || (club && !organizations.length)}
          >
            {pending ? "Reserving your space…" : "Confirm reservation"} <Icon />
          </button>
          <p className="fine">
            Up to 2 hours. One active reservation per email per day.
          </p>
        </form>
      )}
    </Modal>
  );
}
function Schedule({ room, date, onClose }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!configured) return;
        const next = new Date(`${date}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        const rows = await rpc("get_room_schedule", {
          p_room_id: room.id,
          p_from: toInstant(date, "00:00"),
          p_to: toInstant(next.toISOString().slice(0, 10), "00:00"),
        });
        if (active) setItems(rows || []);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [room.id, date]);
  return (
    <Modal title="A look at the day." onClose={onClose}>
      <p>
        {room.name} · {prettyDay(toInstant(date, "12:00"))}
      </p>
      <Message>{error}</Message>
      {loading ? (
        <p role="status">Loading reservations…</p>
      ) : !configured ? (
        <p className="empty">
          Live schedules are available when connected. Preview rooms have no
          real reservations.
        </p>
      ) : items.length ? (
        <div className="schedule-list">
          {items.map((b, i) => (
            <div key={i}>
              <Icon name="clock" />
              <strong>
                {prettyTime(b.start_time)}–{prettyTime(b.end_time)}
              </strong>
              <span>Reserved</span>
            </div>
          ))}
        </div>
      ) : (
        !error && (
          <p className="empty">
            No reservations for this day. Search a time to check availability.
          </p>
        )
      )}
      <p className="fine">
        Times are Eastern. Other guests’ names and email addresses stay private.
      </p>
    </Modal>
  );
}
function Manage({ onClose, onAlternative, onChanged }) {
  const [code, setCode] = useState(""),
    [email, setEmail] = useState(""),
    [booking, setBooking] = useState(null),
    [alternatives, setAlternatives] = useState([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [confirmCancel, setConfirmCancel] = useState(false);
  const credentials = () => ({
    p_code: code.trim().toLowerCase(),
    p_email: email.trim().toLowerCase(),
  });
  async function refresh() {
    const rows = await rpc("get_booking_status", credentials());
    if (!rows?.length)
      throw new Error("No booking found. Check your code and email.");
    setBooking(rows[0]);
    setAlternatives([]);
    if (rows[0].status === "bumped") {
      const options = await rpc("get_bump_alternatives", credentials());
      setAlternatives(options || []);
    }
  }
  async function lookup(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    setNote("");
    setBooking(null);
    setAlternatives([]);
    setConfirmCancel(false);
    try {
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  async function action(kind) {
    setPending(true);
    setError("");
    setNote("");
    try {
      const result = await rpc(kind, credentials());
      if (kind === "cancel_booking" && !result)
        throw new Error(
          "This booking could not be cancelled. It may have already started or changed.",
        );
      setConfirmCancel(false);
      await refresh();
      setNote(
        kind === "check_in"
          ? "You’re checked in. Make yourself at home."
          : "Your reservation has been cancelled.",
      );
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  const started = booking && Date.now() >= Date.parse(booking.start_time);
  return (
    <Modal
      title="Your plans, in one place."
      onClose={() => {
        if (!pending) onClose();
      }}
      wide
    >
      <p className="modal-intro">
        Look up your reservation to check in, cancel, or find a new space.
      </p>
      <form onSubmit={lookup}>
        <div className="form-grid">
          <label>
            Booking code
            <input
              required
              disabled={pending}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setBooking(null);
                setAlternatives([]);
                setConfirmCancel(false);
              }}
              placeholder="Your 6-character code"
              autoCapitalize="none"
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              required
              disabled={pending}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setBooking(null);
                setAlternatives([]);
                setConfirmCancel(false);
              }}
              placeholder="you@uga.edu"
              autoComplete="email"
            />
          </label>
        </div>
        <button className="button full" disabled={pending || !configured}>
          {pending ? "One moment…" : "Find my booking"}
          <Icon />
        </button>
      </form>
      {!configured && (
        <Message>
          Preview mode — connect your Supabase project to manage real bookings.
        </Message>
      )}
      <Message>{error}</Message>
      <Message good>{note}</Message>
      {booking && (
        <section className="managed-booking">
          <div className="result-heading">
            <h3>{booking.room_name}</h3>
            <span className={`status ${booking.status}`}>{booking.status}</span>
          </div>
          <p>
            {prettyDay(booking.start_time)} · {prettyTime(booking.start_time)}–
            {prettyTime(booking.end_time)} ET
          </p>
          <p>
            {booking.group_size} people · {booking.booker_name}
          </p>
          {booking.checked_in_at && (
            <p className="success-text">
              ✓ Checked in at {prettyTime(booking.checked_in_at)}
            </p>
          )}
          {booking.status === "active" && (
            <div className="booking-actions">
              {!booking.checked_in_at && (
                <button
                  className="button"
                  disabled={
                    pending ||
                    !started ||
                    Date.now() >= Date.parse(booking.end_time)
                  }
                  onClick={() => action("check_in")}
                >
                  {started ? "Check in" : "Check-in opens at your start time"}
                  <Icon name="check" />
                </button>
              )}
              {!started && !confirmCancel && (
                <button
                  className="text-button"
                  disabled={pending}
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel reservation
                </button>
              )}
              {confirmCancel && (
                <div className="cancel-confirm">
                  <p>
                    Cancel this reservation? The room will become available to
                    others.
                  </p>
                  <button
                    className="button danger"
                    disabled={pending}
                    onClick={() => action("cancel_booking")}
                  >
                    Yes, cancel
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setConfirmCancel(false)}
                  >
                    Keep reservation
                  </button>
                </div>
              )}
            </div>
          )}
          {booking.status === "released" && (
            <p className="fine">
              This room was released because check-in wasn’t completed in time.
              You can search for a new reservation.
            </p>
          )}
          {booking.status === "bumped" && (
            <>
              <p className="fine">
                A higher-priority group received this room. Here are other
                spaces for your group.
              </p>
              <div className="alternatives">
                {alternatives.map((a, i) => (
                  <button key={i} onClick={() => onAlternative(a, booking)}>
                    <span>
                      <strong>{a.room_name}</strong>
                      <small>
                        {prettyDay(a.start_time)} · {prettyTime(a.start_time)}–
                        {prettyTime(a.end_time)}
                        {a.same_time ? " · Same time" : ""}
                      </small>
                    </span>
                    <Icon />
                  </button>
                ))}
              </div>
              {!alternatives.length && (
                <p>No alternatives found. Try a new search.</p>
              )}
            </>
          )}
        </section>
      )}
    </Modal>
  );
}

function Chatbot({ onSelectRoom }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [roomResults, setRoomResults] = useState([])
  const [bookingDetails, setBookingDetails] = useState(null)
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(e) {
    e.preventDefault();

    const content = input.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user", content }];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data, error: functionError } = await supabase.functions.invoke(
        "chatbot",
        {
          body: { messages: nextMessages },
        },
      );

      console.log("Chatbot response:", data);

      if (functionError) throw functionError;

      setRoomResults(data.rooms || [])
      setBookingDetails(data.booking || null)

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbot-widget">
      {open && (
        <section className="chatbot-panel" aria-label="Study Space chatbot">
          <div className="chatbot-header">
            <div>
              <strong>Study Space Assistant</strong>
              <p>Find your next study spot.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="chatbot-messages" aria-live="polite">
            {messages.length === 0 && (
              <p className="chatbot-welcome">
                Hi! Looking for a quiet place to study? Tell me when, where, and
                for how many people.
              </p>
            )}

            {messages.map((message, index) => (
              <div key={index} className={`chatbot-message ${message.role}`}>
                {message.content}
              </div>
            ))}

            {roomResults.length > 0 && bookingDetails && (
              <div className="chatbot-room-results">
                <strong>{roomResults.length} available rooms</strong>

                {roomResults.slice(0, 5).map((room) => (
                  <div className="chatbot-room-card" key={room.id}>
                    <div>
                      <strong>{room.name}</strong>
                      <p>Up to {room.capacity} people</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                      setOpen(false);
                      onSelectRoom(room, bookingDetails);
                    }}
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}

            {loading && <p>Finding your space…</p>}
            {error && <p role="alert">{error}</p>}
          </div>

          <form onSubmit={sendMessage} className="chatbot-form">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about study rooms..."
              aria-label="Chat message"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close chatbot" : "Open chatbot"}
      >
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}

export default function App() {
  const [locations, setLocations] = useState(configured ? [] : demoLocations),
    [organizations, setOrganizations] = useState([]),
    [form, setForm] = useState(initialSearch),
    [results, setResults] = useState([]),
    [searched, setSearched] = useState(null),
    [loading, setLoading] = useState(false),
    [initLoading, setInitLoading] = useState(configured),
    [error, setError] = useState(""),
    [selection, setSelection] = useState(null),
    [schedule, setSchedule] = useState(null),
    [manage, setManage] = useState(false),
    [visible, setVisible] = useState(6),
    [notice, setNotice] = useState("");

  const [exploring, setExploring] = useState(null);

  const finder = useRef(null),
    request = useRef(0);
  useEffect(() => {
    let active = true;
    async function boot() {
      if (!configured) return;
      try {
        const [loc, org] = await Promise.all([
          getLocations(),
          rpc("get_organizations", {}),
        ]);
        console.log("Connected to Supabase!");
        console.log("Libraries:", loc);
        console.log("Organizations:", org);
        if (active) {
          setLocations(loc || []);
          setOrganizations(org || []);
          if (loc?.length)
            setForm((s) => ({ ...s, location: String(loc[0].id) }));
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setInitLoading(false);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function search(e) {
    e?.preventDefault();
    const id = ++request.current;
    setLoading(true);
    setError("");
    setNotice("");
    setVisible(6);
    setResults([]);
    setSearched(null);
    try {
      const snapshot = { ...form };
      if (!snapshot.location) throw new Error("Choose a library.");
      const win = searchWindow(snapshot);
      const rows = configured
        ? await rpc("get_available_rooms", {
            p_location_id: Number(snapshot.location),
            p_start: win.start,
            p_end: win.end,
            p_group_size: Number(snapshot.people),
            p_booking_type: snapshot.type,
          })
        : demoRooms(snapshot.location, Number(snapshot.people), snapshot.type);
      if (id === request.current) {
        setResults(rows || []);
        setSearched({ search: snapshot, window: win });
      }
    } catch (e) {
      if (id === request.current) setError(e.message);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  function changed() {
    setResults([]);
    setSearched(null);
    setNotice(
      "Your reservation changed. Search again for the latest availability.",
    );
  }
  function chooseAlternative(a, b) {
    setManage(false);
    setSelection({
      alternative: true,
      room: {
        id: a.room_id,
        name: a.room_name,
        capacity: a.capacity,
        would_bump: false,
      },
      window: { start: a.start_time, end: a.end_time },
      search: { ...form, people: String(b.group_size), type: "student" },
    });
    setNotice(
      "Choose your booking type when reserving an alternative. Organization groups need their access code.",
    );
  }
  function jump() {
    finder.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
  if (exploring) {
    document.getElementById("library-explorer")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}, [exploring]);
  const selectedLoc = locations.find(
    (l) => String(l.id) === String(searched?.search.location || form.location),
  );
  return (
    <>
      <a className="skip-link" href="#finder">
        Skip to room finder
      </a>
      <header className="nav">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="#finder">Find a space</a>
          <a href="#how">How it works</a>
          <button onClick={() => setManage(true)}>
            My booking <Icon name="up" size={16} />
          </button>
        </nav>
        <span className="nav-note">A CAMPUS SIDE PROJECT</span>
      </header>
      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" /> A LITTLE ROOM TO THINK
            </div>
            <h1>
              Good ideas
              <br />
              need <span className="serif">space.</span>
            </h1>
            <p>
              For the big exam. The next big idea.
              <br />
              Or just a quiet hour to get things done.
              <br />
              Find your place on campus.
            </p>
            <div className="hero-actions">
              <button className="button" onClick={jump}>
                Find your space{" "}
                <span className="button-circle">
                  <Icon name="up" size={18} />
                </span>
              </button>
              <span className="small-note">
                Less searching.
                <br />
                More doing.
              </span>
            </div>
            <div className="hero-bottom">
              <span>MADE FOR CAMPUS LIFE</span>
              <span>ATHENS, GA ↗</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-top">
              <span>THE STUDY SPACE COLLECTION</span>
              <span>01 — 05</span>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <RoomArt hero />
            <div className="floating-note">
              <span className="note-icon">
                <Icon name="sun" />
              </span>
              <span>
                A fresh perspective.<small>Starts with the right space.</small>
              </span>
            </div>
            <div className="visual-bottom">
              <span>ROOM FOR YOUR NEXT CHAPTER</span>
              <span className="round-arrow">
                <Icon name="up" />
              </span>
            </div>
          </div>
        </section>
        <section className="campus-strip" aria-label="Campus locations">
          <div className="marquee-viewport">
            <div className="marquee-track">
              {[0, 1].map((copy) => (
                <div
                  className="marquee-group"
                  key={copy}
                  aria-hidden={copy === 1 ? "true" : undefined}
                >
                  {[
                    "Main Library",
                    "McBay Science",
                    "Miller Learning Center",
                    "Art Library",
                    "Carnegie",
                  ].map((name) => (
                    <span className="marquee-item" key={name}>
                      <span>{name}</span>
                      <i aria-hidden="true">✳</i>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="finder" className="finder section" ref={finder}>
          <div className="section-heading reveal">
            <div>
              <div className="eyebrow">01 / FIND YOUR FOCUS</div>
              <h2>
                A space for <span className="serif">every plan.</span>
              </h2>
            </div>
            <p>
              Bring your people. We’ll help with the place.
              <br />
              Choose when, where, and how many.
            </p>
          </div>
          {!configured && (
            <div className="preview-banner">
              <span className="dot" /> DESIGN PREVIEW{" "}
              <span>Explore sample spaces. Real bookings are turned off.</span>
            </div>
          )}
          <form className="search-panel" onSubmit={search}>
            <div className="search-top">
              <div
                className="booking-tabs"
                role="group"
                aria-label="Booking type"
              >
                {[
                  ["student", "Student"],
                  ["club", "Club"],
                  ["professional_club", "Professional club"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    aria-pressed={form.type === value}
                    className={form.type === value ? "active" : ""}
                    key={value}
                    onClick={() => update("type", value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span>
                <Icon name="clock" size={15} /> All times Eastern
              </span>
            </div>
            <div className="search-fields">
              <label>
                Where
                <select
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  required
                  disabled={initLoading}
                >
                  <option value="" disabled>
                    Choose a library
                  </option>
                  {locations.map((l) => (
                    <option value={l.id} key={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  required
                  value={form.date}
                  min={dateKey()}
                  max={dateKey(new Date(Date.now() + 14 * 86400000))}
                  onChange={(e) => update("date", e.target.value)}
                />
              </label>
              <label>
                Start time
                <input
                  type="time"
                  required
                  step="900"
                  value={form.time}
                  onChange={(e) => update("time", e.target.value)}
                />
              </label>
              <label>
                Duration
                <select
                  value={form.duration}
                  onChange={(e) => update("duration", e.target.value)}
                >
                  {[15, 30, 45, 60, 75, 90, 105, 120].map((n) => (
                    <option key={n} value={n}>
                      {n < 60
                        ? `${n} minutes`
                        : `${n / 60} hour${n === 60 ? "" : "s"}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                People
                <input
                  required
                  type="number"
                  min="1"
                  max="1000"
                  value={form.people}
                  onChange={(e) => update("people", e.target.value)}
                />
              </label>
              <button
                className="button search-button"
                disabled={loading || initLoading || !locations.length}
              >
                {loading ? "Searching…" : "Find a room"}
                <Icon />
              </button>
            </div>
          </form>
          <Message>{error}</Message>
          <Message good>{notice}</Message>
          {!searched && !loading && !error && (
            <div className="finder-idle">
              <div>
                <span className="eyebrow">YOUR NEXT GREAT STUDY SESSION</span>
                <h3>It starts with a little room.</h3>
                <p>Set your plans above to see spaces that fit.</p>
              </div>
              <div className="idle-features">
                <span>
                  <Icon name="clock" /> Up to 2 hours
                </span>
                <span>
                  <Icon name="people" /> Solo or together
                </span>
                <span>
                  <Icon name="book" /> Book 14 days ahead
                </span>
              </div>
            </div>
          )}
          {loading && (
            <div
              className="room-grid"
              role="status"
              aria-label="Searching for available rooms"
            >
              {[1, 2, 3].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          )}
          {searched && (
            <>
              <div className="results-toolbar">
                <div>
                  <strong>
                    {configured
                      ? `${results.length} spaces match your plans`
                      : `${results.length} sample spaces`}
                  </strong>
                  <span>
                    {selectedLoc?.name} · {prettyDay(searched.window.start)} ·{" "}
                    {prettyTime(searched.window.start)}–
                    {prettyTime(searched.window.end)}
                  </span>
                </div>
                <span className="sort-note">
                  Smallest fit first <Icon name="people" size={16} />
                </span>
              </div>
              {!results.length ? (
                <div className="empty">
                  <h3>A different time might do it.</h3>
                  <p>
                    No rooms match this search. Try another library, time, or
                    group size.
                  </p>
                </div>
              ) : (
                <div className="room-grid">
                  {results.slice(0, visible).map((r, i) => (
                    <article className="room-card" key={r.id}>
                      <div className={`card-art art-${i % 3}`}>
                        <RoomArt variant={i} />
                        <span className="card-tag">
                          {r.room_type === "classroom"
                            ? "CLASSROOM"
                            : "STUDY ROOM"}
                        </span>
                        <span className="illustration-label">ILLUSTRATION</span>
                      </div>
                      <div className="card-body">
                        <div className="room-meta">
                          <span>
                            <Icon name="people" size={16} /> Up to {r.capacity}
                          </span>
                          {r.would_bump ? (
                            <span className="bump-tag">Priority booking</span>
                          ) : (
                            <span>{configured ? "Available" : "Sample"}</span>
                          )}
                        </div>
                        <h3>{r.name}</h3>
                        <p>{selectedLoc?.name}</p>
                        <div className="card-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              setSchedule({
                                room: r,
                                date: searched.search.date,
                              })
                            }
                          >
                            View schedule
                          </button>
                          <button
                            className="room-book"
                            onClick={() =>
                              setSelection({ room: r, ...searched })
                            }
                          >
                            {configured ? "Reserve" : "Preview booking"}
                            <Icon name="up" size={18} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {results.length > visible && (
                <button
                  className="button secondary load-more"
                  onClick={() => setVisible((v) => v + 6)}
                >
                  Show more spaces <Icon />
                </button>
              )}
            </>
          )}
        </section>
        <section className="how-section section" id="how">
          <div className="section-heading reveal">
            <div>
              <div className="eyebrow">02 / LESS FRICTION, MORE FOCUS</div>
              <h2>
                Settle in.
                <br />
                <span className="serif">Get going.</span>
              </h2>
            </div>
            <p>
              A few simple steps between you
              <br />
              and your next productive hour.
            </p>
          </div>
          <div className="steps">
            <article className="reveal">
              <span className="step-number">01</span>
              <Icon name="pin" size={30} />
              <h3>Find your corner.</h3>
              <p>
                Pick a library, a time, and your group size. See the rooms that
                fit your plans.
              </p>
            </article>
            <article className="reveal">
              <span className="step-number">02</span>
              <Icon name="book" size={30} />
              <h3>Make it yours.</h3>
              <p>
                Reserve with your name and email. Keep your booking code
                close—you’ll need it later.
              </p>
            </article>
            <article className="reveal">
              <span className="step-number">03</span>
              <Icon name="check" size={30} />
              <h3>Show up. Check in.</h3>
              <p>
                Check in when your reservation starts. A 15-minute window keeps
                spaces moving for everyone.
              </p>
            </article>
          </div>
        </section>
        <section className="faq-section section reveal">
          <div>
            <div className="eyebrow">A FEW THINGS TO KNOW</div>
            <h2>
              Good questions.
              <br />
              <span className="serif">Simple answers.</span>
            </h2>
          </div>
          <div className="faqs">
            {[
              [
                "How long can I reserve a room?",
                "Reserve in 15-minute increments for up to two hours, up to 14 days ahead. Each email can have one active reservation per day.",
              ],
              [
                "What if I’m booking for a club?",
                "Choose your group type when searching. To reserve, select your registered organization and enter its access code. Your organization determines your priority; smaller student-only study rooms stay reserved for students.",
              ],
              [
                "What happens if my booking is bumped?",
                "An eligible higher-priority group can take a reservation that hasn’t started. Look up your booking to see its status and available alternatives.",
              ],
              [
                "Can I cancel or check in here?",
                "Yes. Open My booking and enter your booking code and email. Cancel before your reservation starts, or check in when it begins. Unchecked-in bookings may be released after the 15-minute grace period.",
              ],
              [
                "Is this an official UGA reservation service?",
                "This is an independent student project. Reservations made here belong to this project’s database and do not reserve rooms in UGA’s official booking systems.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        
        
        {exploring ? (
          <LibraryExplorer
            key={exploring.id}
            location={exploring}
            onBack={() => setExploring(null)}
            onReserve={(room, window, search) => {
              setSelection({
                room,
                window,
                search,
              });
            }}
          />
        ) : (
          <LibraryGallery
            locations={locations}
            onChoose={(location) => setExploring(location)}
          />
        )}


      </main>
      <footer>
        <Logo />
        <span>AN INDEPENDENT STUDENT PROJECT · ATHENS, GA</span>
        <a href="#home">Back to top ↑</a>
      </footer>
      {selection && (
        <Booking
          selection={selection}
          organizations={organizations}
          onClose={() => setSelection(null)}
          onBooked={changed}
        />
      )}{" "}
      {schedule && <Schedule {...schedule} onClose={() => setSchedule(null)} />}{" "}
      {manage && (
        <Manage
          onClose={() => setManage(false)}
          onAlternative={chooseAlternative}
          onChanged={changed}
        />
      )}
      <Chatbot
        onSelectRoom={(room, booking) => {
          setSelection({
            room,
            window: {
              start: booking.start,
              end: booking.end,
            },
            search: {
              ...form,
              people: String(booking.group_size),
              type: "student",
            },
          });
        }}
      />
    </>
  );
}
