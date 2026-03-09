// Splits the loaded squad into the four FPL positions for rendering.
export function groupByPosition(players) {
  const groups = { GKP: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) {
    groups[p.position].push(p);
  }
  return groups;
}

// Chooses the gameweek the app should treat as "current" for picks and points.
export function resolveCurrentEvent(bootstrap) {
  return (
    bootstrap.events.find((e) => e.is_current) ||
    bootstrap.events.find((e) => e.is_next) ||
    bootstrap.events[bootstrap.events.length - 1] ||
    null
  );
}

// Chooses the next fixture context used for forward-looking report data.
export function resolveUpcomingEvent(bootstrap) {
  return (
    bootstrap.events.find((e) => e.is_next) ||
    bootstrap.events.find((e) => e.is_current) ||
    bootstrap.events[bootstrap.events.length - 1] ||
    null
  );
}

// Builds a quick lookup from team id to its opponent label/difficulty in one GW.
export function buildFixturesByTeamId(fixturesJson, teamsById, gw) {
  const fixturesByTeamId = new Map();
  const gwFixtures = fixturesJson.filter((f) => f.event === gw);
  for (const f of gwFixtures) {
    const homeTeam = teamsById.get(f.team_h);
    const awayTeam = teamsById.get(f.team_a);
    if (homeTeam && awayTeam) {
      fixturesByTeamId.set(
        f.team_h,
        {
          label: `${awayTeam.short_name} (H)`,
          difficulty: f.team_h_difficulty,
        }
      );
      fixturesByTeamId.set(
        f.team_a,
        {
          label: `${homeTeam.short_name} (A)`,
          difficulty: f.team_a_difficulty,
        }
      );
    }
  }
  return fixturesByTeamId;
}

// Averages each team's next few fixture difficulties for the rating model.
export function buildUpcomingFixtureDifficultyByTeamId(
  fixturesJson,
  currentGw,
  count = 3
) {
  const upcomingByTeamId = new Map();
  const future = fixturesJson
    .filter((f) => f.event && f.event >= currentGw)
    .sort((a, b) => a.event - b.event);

  for (const f of future) {
    const home = f.team_h;
    const away = f.team_a;

    if (!upcomingByTeamId.has(home)) {
      upcomingByTeamId.set(home, []);
    }
    if (!upcomingByTeamId.has(away)) {
      upcomingByTeamId.set(away, []);
    }

    if (upcomingByTeamId.get(home).length < count) {
      upcomingByTeamId.get(home).push(f.team_h_difficulty);
    }
    if (upcomingByTeamId.get(away).length < count) {
      upcomingByTeamId.get(away).push(f.team_a_difficulty);
    }
  }

  const averages = new Map();
  for (const [teamId, diffs] of upcomingByTeamId.entries()) {
    if (!diffs.length) continue;
    const avg = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    averages.set(teamId, avg);
  }

  return averages;
}

// Merges manager picks with bootstrap player data and fixture context.
export function enrichSquad(picksJson, bootstrap, fixturesByTeamId) {
  const elementsById = new Map(bootstrap.elements.map((el) => [el.id, el]));
  const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const positionByType = new Map([
    [1, "GKP"],
    [2, "DEF"],
    [3, "MID"],
    [4, "FWD"],
  ]);

  return picksJson.picks
    .map((pick) => {
      const el = elementsById.get(pick.element);
      if (!el) return null;

      return {
        id: el.id,
        name: el.web_name,
        position: positionByType.get(el.element_type) ?? "UNK",
        pickPosition: pick.position,
        teamId: el.team,
        teamShortName: teamsById.get(el.team)?.short_name ?? "",
        price: (el.now_cost / 10).toFixed(1),
        points_per_game: Number(el.points_per_game ?? 0),
        form: Number(el.form ?? 0),
        expectedPoints: Number(el.ep_next ?? el.ep_this ?? 0),
        points: el.event_points,
        selectedBy: Number(el.selected_by_percent),
        isCaptain: pick.is_captain,
        isVice: pick.is_vice_captain,
        multiplier: pick.multiplier,
        eventPoints: el.event_points,
        fixtureLabel: fixturesByTeamId.get(el.team)?.label ?? "TBD",
        fixtureDifficulty: fixturesByTeamId.get(el.team)?.difficulty ?? 3,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
      return order[a.position] - order[b.position] || a.name.localeCompare(b.name);
    });
}

// Totals the gameweek score using captain multipliers and bench multipliers.
export function calculateTotalScore(enriched) {
  return enriched.reduce(
    (sum, player) => sum + player.eventPoints * player.multiplier,
    0
  );
}
