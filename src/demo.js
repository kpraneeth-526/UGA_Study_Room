export const demoLocations = [
  { id: 1, name: "Main Library" },
  { id: 2, name: "McBay Science Library" },
  { id: 3, name: "Miller Learning Center" },
  { id: 4, name: "Art Library" },
  { id: 5, name: "Carnegie Library Learning Center (Health Sciences Campus)" },
];
export function demoRooms(location, people, type) {
  const examples =
    type === "student"
      ? [
          { id: 1, name: "Group Study Room 01", capacity: 4 },
          { id: 2, name: "Group Study Room 02", capacity: 4 },
          { id: 3, name: "Group Study Room 03", capacity: 8 },
        ]
      : [
          { id: 4, name: "Group Study Hall", capacity: 12 },
          { id: 5, name: "Classroom 200", capacity: 30 },
        ];
  return examples
    .filter((r) => r.capacity >= people)
    .map((r) => ({
      ...r,
      location_id: Number(location),
      room_type: r.capacity === 30 ? "classroom" : "study",
      would_bump: false,
    }));
}
