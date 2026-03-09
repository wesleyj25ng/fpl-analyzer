// Helper function for recent form and minutes rates.
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Measures volatility in recent returns so the rating can penalize inconsistency.
function stdDev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

// Returns the most recent matches where the player actually appeared.
export function getPlayedHistory(history, count = 4) {
  if (!Array.isArray(history) || history.length === 0) return [];
  return history
    .filter((game) => Number(game.minutes ?? 0) > 0)
    .slice(-count);
}

// Returns the most recent recorded matches, including 0-minute outings.
export function getRecentHistory(history, count = 4) {
  if (!Array.isArray(history) || history.length === 0) return [];
  return history.slice(-count);
}

// Converts post-match expected stats into an inferred FPL xP for that match.
export function calculateHistoricalExpectedPoints(game, position) {
  const minutes = Number(game.minutes ?? 0);
  if (minutes <= 0) return 0;

  const expectedGoals = Number(game.expected_goals ?? 0);
  const expectedAssists = Number(game.expected_assists ?? 0);
  const expectedGoalsConceded = Number(game.expected_goals_conceded ?? 0);
  const appearancePoints = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;

  const goalPointsByPosition = {
    GKP: 6,
    DEF: 6,
    MID: 5,
    FWD: 4,
  };
  const cleanSheetPointsByPosition = {
    GKP: 4,
    DEF: 4,
    MID: 1,
    FWD: 0,
  };

  const goalPoints = expectedGoals * (goalPointsByPosition[position] ?? 0);
  const assistPoints = expectedAssists * 3;
  const cleanSheetPoints =
    minutes >= 60 &&
    (position === "GKP" || position === "DEF" || position === "MID")
      ? Math.exp(-expectedGoalsConceded) *
        (cleanSheetPointsByPosition[position] ?? 0)
      : 0;
  const goalsConcededPenalty =
    position === "GKP" || position === "DEF" ? expectedGoalsConceded * -0.5 : 0;

  return Number(
    (
      appearancePoints +
      goalPoints +
      assistPoints +
      cleanSheetPoints +
      goalsConcededPenalty
    ).toFixed(2)
  );
}

// Shapes the last recorded matches into the chart series shown in the player modal.
export function buildRecentChart(history, position, count = 6) {
  return getRecentHistory(history, count).map((game) => ({
    label: `GW${game.round ?? "?"}`,
    actualPoints: Number(game.total_points ?? 0),
    expectedPoints: calculateHistoricalExpectedPoints(game, position),
  }));
}

// Derives all recent-history metrics consumed by the squad rating pipeline.
export function summarizePlayerHistory(history, position, formCount = 4) {
  const recentGames = getPlayedHistory(history, formCount);
  const recentScheduledGames = getRecentHistory(history, formCount);
  const recentPoints = recentGames.map((game) => Number(game.total_points ?? 0));
  const scheduledMinutes = recentScheduledGames.map((game) => Number(game.minutes ?? 0));
  const goals = recentGames.reduce(
    (sum, game) => sum + Number(game.goals_scored ?? 0),
    0
  );
  const assists = recentGames.reduce(
    (sum, game) => sum + Number(game.assists ?? 0),
    0
  );
  const expectedGoals = recentGames.reduce(
    (sum, game) => sum + Number(game.expected_goals ?? 0),
    0
  );
  const expectedAssists = recentGames.reduce(
    (sum, game) => sum + Number(game.expected_assists ?? 0),
    0
  );
  const defconHits = recentGames.filter(
    (game) => Number(game.defensive_contribution ?? 0) >= 10
  ).length;

  return {
    recentPoints,
    recentChart: buildRecentChart(history, position),
    recentForm: recentPoints.length ? mean(recentPoints) : 0,
    nailedRate: scheduledMinutes.length ? mean(scheduledMinutes) / 90 : 0,
    consistencyStd: recentPoints.length ? stdDev(recentPoints) : 0,
    xgiDelta: goals + assists - (expectedGoals + expectedAssists),
    defconRate: recentGames.length ? defconHits / recentGames.length : 0,
  };
}
