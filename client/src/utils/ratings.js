import { summarizePlayerHistory } from "./playerHistory";

export const DEFAULT_RATING_WEIGHTS = {
  quality: 0.28, // points per game
  value: 0.18, // points per million
  form: 0.15, // last 4 games
  fixtures: 0.15, // next 3 difficulty
  nailed: 0.1, // minutes reliability
  consistency: 0.04, // variance penalty
  xgi: 0.05, // xGI over/under performance
  defcon: 0.15, // defensive contribution frequency (DEF)
};

const RATING_SCALE = {
  min: 0,
  max: 100,
};

const RATING_CURVE = 1.35;

const POSITION_BY_TYPE = new Map([
  [1, "GKP"],
  [2, "DEF"],
  [3, "MID"],
  [4, "FWD"],
]);

// Reusable clamp used throughout normalization and score post-processing.
function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

// Normalizes a metric inside a position-specific range.
function minMaxNormalize(value, min, max, invert = false) {
  if (max === min) return 0.5;
  const t = (value - min) / (max - min);
  return clamp(invert ? 1 - t : t);
}

// Rewards xGI underperformance slightly because it can signal positive regression.
function xgiScore(delta, cap = 2) {
  if (cap <= 0) return 0.5;
  const scaled = 0.5 - (delta / cap) * 0.25;
  return clamp(scaled);
}

// Collects all raw inputs needed to rate one player.
function buildPlayerMetrics(player, summary, upcomingDifficultyByTeamId) {
  const historySummary = summarizePlayerHistory(summary?.history ?? [], player.position);
  const ppg = Number(player.points_per_game ?? 0);
  const price = Number(player.price ?? 0);

  return {
    id: player.id,
    position: player.position,
    ppg,
    value: price > 0 ? ppg / price : 0,
    seasonForm: Number(player.form ?? 0),
    fixtures: Number(upcomingDifficultyByTeamId.get(player.teamId) ?? 3),
    ...historySummary,
  };
}

// Combines normalized metrics into the raw 0-100 player rating.
function buildRawRatedPlayer(player, metric, positionRanges, weights) {
  const ranges = positionRanges?.[metric.position] ?? null;
  const qualityScore = ranges
    ? minMaxNormalize(metric.ppg, ranges.ppg.min, ranges.ppg.max)
    : 0.5;
  const valueScore = ranges
    ? minMaxNormalize(metric.value, ranges.value.min, ranges.value.max)
    : 0.5;
  const seasonFormScore = ranges
    ? minMaxNormalize(metric.seasonForm, ranges.form.min, ranges.form.max)
    : 0.5;
  const last4FormScore = clamp(metric.recentForm / 12);
  const formScore = clamp(seasonFormScore * 0.7 + last4FormScore * 0.3);
  const fixtureScore = clamp(1 - (metric.fixtures - 1) / 4);
  const nailedScore = clamp(metric.nailedRate);
  const consistencyScore = clamp(1 - metric.consistencyStd / 8);
  const xgiScoreValue = xgiScore(metric.xgiDelta, 2);
  const defconScore = clamp(metric.defconRate);

  const weighted =
    qualityScore * weights.quality +
    valueScore * weights.value +
    formScore * weights.form +
    fixtureScore * weights.fixtures +
    nailedScore * weights.nailed +
    consistencyScore * weights.consistency +
    xgiScoreValue * weights.xgi +
    (metric.position === "DEF" ? defconScore * weights.defcon : 0);

  return {
    ...player,
    rating: Math.round(clamp(weighted) * 100),
    recentPoints: metric.recentPoints,
    recentMinutes: metric.recentMinutes,
    recentChart: metric.recentChart,
    recentForm: metric.recentForm,
    fixtureAvg: metric.fixtures,
    nailedRate: metric.nailedRate,
    consistencyStd: metric.consistencyStd,
    ratingBreakdown: {
      quality: qualityScore,
      value: valueScore,
      form: formScore,
      fixtures: fixtureScore,
      nailed: nailedScore,
      consistency: consistencyScore,
      xgi: xgiScoreValue,
      xgiDelta: metric.xgiDelta,
      defconRate: metric.defconRate,
    },
  };
}

// Main rating pipeline: derive metrics, build raw ratings, then rescale/grade.
export function rateSquad(
  squad,
  summariesById,
  upcomingDifficultyByTeamId,
  positionRanges,
  baselineRatingRanges,
  weights = DEFAULT_RATING_WEIGHTS
) {
  const metricsById = new Map(
    squad.map((player) => [
      player.id,
      buildPlayerMetrics(
        player,
        summariesById.get(player.id),
        upcomingDifficultyByTeamId
      ),
    ])
  );

  const rated = squad.map((player) =>
    buildRawRatedPlayer(
      player,
      metricsById.get(player.id),
      positionRanges,
      weights
    )
  );

  const rescaled = rescaleRatingsByPosition(
    rated,
    RATING_SCALE,
    baselineRatingRanges
  );
  return applyPercentileGrades(rescaled);
}

// Builds baseline min/max ranges by position for the core scoring inputs.
export function buildPositionRanges(elements) {
  const buckets = new Map();

  for (const el of elements) {
    const position = POSITION_BY_TYPE.get(el.element_type);
    if (!position) continue;

    if (!buckets.has(position)) {
      buckets.set(position, { ppg: [], value: [], form: [] });
    }

    const ppg = Number(el.points_per_game ?? 0);
    const price = Number(el.now_cost ?? 0) / 10;
    const value = price > 0 ? ppg / price : 0;
    const form = Number(el.form ?? 0);

    buckets.get(position).ppg.push(ppg);
    buckets.get(position).value.push(value);
    buckets.get(position).form.push(form);
  }

  const ranges = {};
  for (const [position, values] of buckets.entries()) {
    ranges[position] = {
      ppg: range(values.ppg),
      value: range(values.value),
      form: range(values.form),
    };
  }

  return ranges;
}

// Creates a comparison baseline so squad ratings are rescaled against the wider player pool.
export function buildBaselineRatingRanges(
  elements,
  upcomingDifficultyByTeamId,
  currentGw,
  positionRanges,
  weights = DEFAULT_RATING_WEIGHTS
) {
  const buckets = new Map();

  for (const el of elements) {
    const position = POSITION_BY_TYPE.get(el.element_type);
    if (!position) continue;

    const ranges = positionRanges?.[position];
    if (!ranges) continue;

    const ppg = Number(el.points_per_game ?? 0);
    const price = Number(el.now_cost ?? 0) / 10;
    const value = price > 0 ? ppg / price : 0;
    const seasonForm = Number(el.form ?? 0);
    const fixtureAvg = Number(
      upcomingDifficultyByTeamId.get(el.team) ?? 3
    );
    const nailed = currentGw > 0 ? Number(el.minutes ?? 0) / (currentGw * 90) : 0;

    const qualityScore = minMaxNormalize(ppg, ranges.ppg.min, ranges.ppg.max);
    const valueScore = minMaxNormalize(value, ranges.value.min, ranges.value.max);
    const formScore = minMaxNormalize(seasonForm, ranges.form.min, ranges.form.max);
    const fixtureScore = clamp(1 - (fixtureAvg - 1) / 4);
    const nailedScore = clamp(nailed);

    const weighted =
      qualityScore * weights.quality +
      valueScore * weights.value +
      formScore * weights.form +
      fixtureScore * weights.fixtures +
      nailedScore * weights.nailed +
      0.5 * weights.consistency +
      0.5 * weights.xgi;

    const rating = Math.round(clamp(weighted) * 100);

    if (!buckets.has(position)) buckets.set(position, []);
    buckets.get(position).push(rating);
  }

  const rangesByPos = {};
  for (const [position, ratings] of buckets.entries()) {
    rangesByPos[position] = {
      min: Math.min(...ratings),
      max: Math.max(...ratings),
    };
  }

  return rangesByPos;
}

// Maps a numeric rating to a letter grade using fixed score bands.
export function getRatingGrade(score) {
  if (score >= 100) return "S";
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 60) return "C+";
  if (score >= 50) return "C";
  if (score >= 40) return "C-";
  if (score >= 30) return "D";
  return "F";
}

// Maps a numeric rating to the color class used on player cards.
export function getRatingClass(score) {
  if (score >= 100) return "rating-s";
  if (score >= 95) return "rating-a-plus";
  if (score >= 90) return "rating-a";
  if (score >= 85) return "rating-a-minus";
  if (score >= 80) return "rating-b-plus";
  if (score >= 75) return "rating-b";
  if (score >= 70) return "rating-b-minus";
  if (score >= 60) return "rating-c-plus";
  if (score >= 50) return "rating-c";
  if (score >= 40) return "rating-c-minus";
  if (score >= 30) return "rating-d";
  return "rating-f";
}

// Adds an in-position percentile and letter grade after ratings are computed.
function applyPercentileGrades(rated) {
  const byPosition = new Map();

  for (const player of rated) {
    const key = player.position;
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key).push(player);
  }

  return rated.map((player) => {
    const group = byPosition.get(player.position) ?? [];
    const sorted = [...group].sort((a, b) => a.rating - b.rating);
    const index = sorted.findIndex((p) => p.id === player.id);
    const percentile =
      group.length <= 1 ? 50 : (index / (group.length - 1)) * 100;
    const grade = getRatingGrade(player.rating, percentile);

    return {
      ...player,
      ratingPercentile: percentile,
      ratingGrade: grade,
    };
  });
}

// Re-centers raw ratings against a baseline distribution for each position.
function rescaleRatingsByPosition(rated, scale, baselineRanges) {
  const byPosition = new Map();

  for (const player of rated) {
    const key = player.position;
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key).push(player.rating);
  }

  return rated.map((player) => {
    const scores = byPosition.get(player.position) ?? [];
    const fallbackMin = Math.min(...scores);
    const fallbackMax = Math.max(...scores);
    const baseline = baselineRanges?.[player.position];
    const min = baseline?.min ?? fallbackMin;
    const max = baseline?.max ?? fallbackMax;
    const span = max - min;
    const targetSpan = scale.max - scale.min;
    const normalized = span === 0 ? 0.5 : (player.rating - min) / span;
    const curved = Math.pow(normalized, RATING_CURVE);
    const adjusted = clamp(
      Math.round(scale.min + curved * targetSpan),
      scale.min,
      scale.max
    );

    return {
      ...player,
      ratingRaw: player.rating,
      rating: adjusted,
    };
  });
}

// Simple min/max helper used when constructing position ranges.
function range(values) {
  if (!values.length) return { min: 0, max: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
