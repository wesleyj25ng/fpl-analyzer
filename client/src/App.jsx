import { useEffect, useMemo, useState } from "react";
import AppHeader from "./components/AppHeader";
import PlayerSearchPanel from "./components/PlayerSearchPanel";
import TeamField from "./components/TeamField";
import PlayerDetail from "./components/PlayerDetail";
import {
  fetchBootstrap,
  fetchEntry,
  fetchEntryPicks,
  fetchFixtures,
  fetchElementSummary,
} from "./api/fpl";
import {
  buildFixturesByTeamId,
  buildUpcomingFixtureDifficultyByTeamId,
  enrichSquad,
  groupByPosition,
  resolveCurrentEvent,
  resolveUpcomingEvent,
} from "./utils/team";
import {
  buildBaselineRatingRanges,
  buildPositionRanges,
  rateSquad,
} from "./utils/ratings";

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildCatalogPlayerFromElement(element, teamsById, fixtureLookup) {
  const positionByType = {
    1: "GKP",
    2: "DEF",
    3: "MID",
    4: "FWD",
  };

  return {
    id: element.id,
    name: element.web_name,
    position: positionByType[element.element_type] ?? "UNK",
    teamId: element.team,
    teamShortName: teamsById.get(element.team)?.short_name ?? "",
    price: (element.now_cost / 10).toFixed(1),
    points_per_game: Number(element.points_per_game ?? 0),
    form: Number(element.form ?? 0),
    expectedPoints: Number(element.ep_next ?? element.ep_this ?? 0),
    points: element.event_points,
    selectedBy: Number(element.selected_by_percent),
    multiplier: 1,
    eventPoints: element.event_points,
    fixtureLabel: fixtureLookup.get(element.team)?.label ?? "TBD",
    fixtureDifficulty: fixtureLookup.get(element.team)?.difficulty ?? 3,
  };
}

export default function App() {
  const [entryId, setEntryId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teamName, setTeamName] = useState("");
  const [eventId, setEventId] = useState(null);
  const [managerName, setManagerName] = useState("");
  const [squad, setSquad] = useState([]); // array of enriched player objects
  const [activeTab, setActiveTab] = useState("report");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [bootstrapData, setBootstrapData] = useState(null);
  const [fixtureLookup, setFixtureLookup] = useState(new Map());
  const [upcomingDifficultyLookup, setUpcomingDifficultyLookup] = useState(new Map());
  const [positionRanges, setPositionRanges] = useState(null);
  const [baselineRatingRanges, setBaselineRatingRanges] = useState(null);
  const [summaryCache, setSummaryCache] = useState(new Map());
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });

  const grouped = useMemo(() => groupByPosition(squad), [squad]);
  const teamsById = useMemo(
    () => new Map((bootstrapData?.teams ?? []).map((team) => [team.id, team])),
    [bootstrapData]
  );
  const squadIds = useMemo(() => new Set(squad.map((player) => player.id)), [squad]);
  const searchCandidates = useMemo(() => {
    const query = normalizeSearchText(searchTerm.trim());
    if (!bootstrapData?.elements?.length || !query) return [];

    return bootstrapData.elements
      .filter((element) => !squadIds.has(element.id))
      .filter((element) => {
        const name = normalizeSearchText(
          `${element.web_name} ${element.first_name} ${element.second_name}`
        );
        return name.includes(query);
      })
      .slice(0, 12)
      .map((element) => buildCatalogPlayerFromElement(element, teamsById, fixtureLookup));
  }, [
    bootstrapData,
    fixtureLookup,
    searchTerm,
    squadIds,
    teamsById,
  ]);
  const searchablePlayers = useMemo(
    () =>
      searchCandidates.map((player) => {
        const summary = summaryCache.get(player.id);
        if (!summary || !positionRanges || !baselineRatingRanges) {
          return { ...player, rating: null };
        }

        const rated = rateSquad(
          [player],
          new Map([[player.id, summary]]),
          upcomingDifficultyLookup,
          positionRanges,
          baselineRatingRanges
        )[0];

        return rated ?? player;
      }),
    [
      baselineRatingRanges,
      positionRanges,
      searchCandidates,
      summaryCache,
      upcomingDifficultyLookup,
    ]
  );
  const overallScore = useMemo(() => {
    if (!squad.length) return 0;
    const total = squad.reduce((sum, player) => sum + (player.rating ?? 0), 0);
    return Math.round(total / squad.length);
  }, [squad]);
  const maxCols = useMemo(() => {
    if (squad.length === 0) return 0;
    return Math.max(
      ...["GKP", "DEF", "MID", "FWD"].map((pos) => grouped[pos].length)
    );
  }, [grouped, squad.length]);
  const fieldWidth =
    maxCols > 0
      ? `calc(${maxCols} * var(--card-width) + ${maxCols - 1} * var(--grid-gap))`
      : "auto";
  const fieldOuterWidth =
    maxCols > 0
      ? `calc(${fieldWidth} + 2 * var(--field-padding) + 2 * var(--field-border))`
      : "auto";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const missingIds = searchCandidates
      .map((player) => player.id)
      .filter((id) => !summaryCache.has(id));

    if (!missingIds.length) return;

    let cancelled = false;

    Promise.all(
      missingIds.map((id) =>
        fetchElementSummary(id)
          .then((summary) => [id, summary])
          .catch(() => null)
      )
    ).then((entries) => {
      if (cancelled) return;

      const validEntries = entries.filter(Boolean);
      if (!validEntries.length) return;

      setSummaryCache((prev) => {
        const next = new Map(prev);
        for (const [id, summary] of validEntries) {
          next.set(id, summary);
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [searchCandidates, summaryCache]);

  async function handleSelectSearchedPlayer(playerId) {
    const element = bootstrapData?.elements?.find((candidate) => candidate.id === playerId);
    if (!element || !positionRanges || !baselineRatingRanges) return;

    const basePlayer = buildCatalogPlayerFromElement(element, teamsById, fixtureLookup);
    const cachedSummary = summaryCache.get(playerId);
    const summary = cachedSummary ?? (await fetchElementSummary(playerId));

    if (!cachedSummary) {
      setSummaryCache((prev) => {
        const next = new Map(prev);
        next.set(playerId, summary);
        return next;
      });
    }

    const ratedPlayer = rateSquad(
      [basePlayer],
      new Map([[playerId, summary]]),
      upcomingDifficultyLookup,
      positionRanges,
      baselineRatingRanges
    )[0];

    setSelectedPlayer(ratedPlayer);
  }

  async function handleLoadTeam() {
    const id = entryId.trim();
    if (!id || !/^\d+$/.test(id)) {
      setError("Please enter a valid numeric ID.");
      return;
    }

    setLoading(true);
    setError("");
    setTeamName("");
    setEventId(null);
    setSquad([]);
    setSearchTerm("");
    setSelectedPlayer(null);

    try {
      // 1) Get bootstrap data (players, teams, current GW)
      const bootstrap = await fetchBootstrap();

      const currentEvent = resolveCurrentEvent(bootstrap);
      const upcomingEvent = resolveUpcomingEvent(bootstrap);

      if (!currentEvent) throw new Error("Could not determine current gameweek.");
      if (!upcomingEvent) throw new Error("Could not determine upcoming gameweek.");
      const currentGw = currentEvent.id;
      const upcomingGw = upcomingEvent.id;

      // 2) Fetch entry picks for that GW
      const [entryJson, picksJson, fixturesJson] = await Promise.all([
        fetchEntry(id),
        fetchEntryPicks(id, currentGw),
        fetchFixtures(),
      ]);

      // 3) Build fixtures lookup for the upcoming GW used in report mode
      const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
      const fixturesByTeamId = buildFixturesByTeamId(
        fixturesJson,
        teamsById,
        upcomingGw
      );
      const enriched = enrichSquad(picksJson, bootstrap, fixturesByTeamId);
      const upcomingDifficultyByTeamId = buildUpcomingFixtureDifficultyByTeamId(
        fixturesJson,
        upcomingGw,
        3
      );
      const positionRanges = buildPositionRanges(bootstrap.elements);
      const baselineRatingRanges = buildBaselineRatingRanges(
        bootstrap.elements,
        upcomingDifficultyByTeamId,
        upcomingGw,
        positionRanges
      );

      const summaryEntries = await Promise.all(
        enriched.map((player) =>
          fetchElementSummary(player.id).then((summary) => [player.id, summary])
        )
      );
      const summariesById = new Map(summaryEntries);
      const rated = rateSquad(
        enriched,
        summariesById,
        upcomingDifficultyByTeamId,
        positionRanges,
        baselineRatingRanges
      );

      setTeamName(entryJson.name);
      setManagerName(`${entryJson.player_first_name} ${entryJson.player_last_name}`.trim());
      setEventId(currentGw);
      setSquad(rated);
      setBootstrapData(bootstrap);
      setFixtureLookup(fixturesByTeamId);
      setUpcomingDifficultyLookup(upcomingDifficultyByTeamId);
      setPositionRanges(positionRanges);
      setBaselineRatingRanges(baselineRatingRanges);
      setSummaryCache(summariesById);
      setSelectedPlayer(null);
    } catch (e) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setEntryId("");
    setLoading(false);
    setError("");
    setTeamName("");
    setEventId(null);
    setManagerName("");
    setSquad([]);
    setSearchTerm("");
    setActiveTab("report");
    setBootstrapData(null);
    setFixtureLookup(new Map());
    setUpcomingDifficultyLookup(new Map());
    setPositionRanges(null);
    setBaselineRatingRanges(null);
    setSummaryCache(new Map());
    setSelectedPlayer(null);
  }

  return (
    <div className="app">
      <button
        className="theme-toggle"
        type="button"
        onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        aria-label="Toggle light and dark mode"
      >
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      {teamName && (
        <button className="back-button" type="button" onClick={handleReset}>
          <span className="back-icon" aria-hidden="true">{"<"}</span>
          Not your team? Go back
        </button>
      )}
      {!teamName && (
        <div className="controls">
          <div className="title">Analyze your FPL Team.</div>
          <div className="entry-hint">Enter your ID</div>
          <input
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            placeholder="e.g. 3963259"
            className="entry-input"
          />
          <button
            onClick={handleLoadTeam}
            disabled={loading || !entryId.trim()}
            className="load-button"
          >
            {loading ? "Loading..." : "Load Team"}
          </button>
          {error && <div className="error-text">{error}</div>}
        </div>
      )}

      {teamName && (
        <AppHeader
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          overallScore={overallScore}
          teamName={teamName}
          managerName={managerName}
          eventId={eventId}
        />
      )}

      {selectedPlayer && (
        <PlayerDetail player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}

      {error && teamName && <div className="error-text">{error}</div>}

      {teamName && activeTab === "search" && (
        <PlayerSearchPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          players={searchablePlayers}
          onSelectPlayer={handleSelectSearchedPlayer}
        />
      )}

      {squad.length > 0 && activeTab !== "search" && (
        <TeamField
          grouped={grouped}
          squad={squad}
          fieldOuterWidth={fieldOuterWidth}
          mode={activeTab}
          onSelectPlayer={setSelectedPlayer}
        />
      )}
    </div>
  );
}
