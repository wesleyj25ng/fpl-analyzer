const FPL = {
  // Frontend talks to the local proxy instead of the public FPL API directly.
  BOOTSTRAP: "http://localhost:3001/api/bootstrap-static",
  FIXTURES: "http://localhost:3001/api/fixtures",
  ENTRY: (entryId) => `http://localhost:3001/api/entry/${entryId}`,
  ENTRY_PICKS: (entryId, eventId) =>
    `http://localhost:3001/api/entry/${entryId}/event/${eventId}/picks`,
};

// Loads the full bootstrap payload: players, teams, and event metadata.
export async function fetchBootstrap() {
  const res = await fetch(FPL.BOOTSTRAP);
  if (!res.ok) throw new Error("Failed to load FPL bootstrap data.");
  return res.json();
}

// Loads the manager/entry record for a given FPL team id.
export async function fetchEntry(entryId) {
  const res = await fetch(FPL.ENTRY(entryId));
  return res.ok ? res.json() : null;
}

// Loads the selected squad for one specific gameweek.
export async function fetchEntryPicks(entryId, eventId) {
  const res = await fetch(FPL.ENTRY_PICKS(entryId, eventId));
  if (!res.ok) {
    if (res.status === 404) throw new Error("Entry ID not found.");
    throw new Error("Failed to load team picks. Try again.");
  }
  return res.json();
}

// Loads the global fixture list used to derive current and upcoming opponents.
export async function fetchFixtures() {
  const res = await fetch(FPL.FIXTURES);
  if (!res.ok) throw new Error("Failed to load fixtures. Try again.");
  return res.json();
}

// Loads one player's detailed history and expected-stat breakdown.
export async function fetchElementSummary(playerId) {
  const res = await fetch(`http://localhost:3001/api/element-summary/${playerId}`);
  if (!res.ok) throw new Error("Failed to load player history.");
  return res.json();
}

export default FPL;
