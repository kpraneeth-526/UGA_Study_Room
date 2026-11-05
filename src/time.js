export const ZONE = "America/New_York";
export const dateKey = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export const clockKey = (d) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(d));
export const prettyDay = (d) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(d));
export const prettyTime = (d) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
export function toInstant(date, time) {
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) throw new Error("Choose a valid date and time.");
  let value = wall;
  for (let i = 0; i < 4; i++) {
    const d = new Date(value);
    const displayed = Date.parse(`${dateKey(d)}T${clockKey(d)}:00Z`);
    value += wall - displayed;
  }
  const result = new Date(value);
  if (dateKey(result) !== date || clockKey(result) !== time)
    throw new Error(
      "That time does not exist because of the daylight-saving change. Choose another time.",
    );
  return result.toISOString();
}
export function initialSearch() {
  const next = new Date(Math.ceil((Date.now() + 15 * 60000) / 900000) * 900000);
  return {
    location: "1",
    date: dateKey(next),
    time: clockKey(next),
    duration: "60",
    people: "2",
    type: "student",
  };
}
export function searchWindow(form) {
  const start = toInstant(form.date, form.time);
  const end = new Date(
    Date.parse(start) + Number(form.duration) * 60000,
  ).toISOString();
  if (Date.parse(start) < Date.now() - 15 * 60000)
    throw new Error("Choose a start time in the future.");
  if (Date.parse(start) > Date.now() + 14 * 86400000)
    throw new Error("Reservations open up to 14 days ahead.");
  return { start, end };
}
