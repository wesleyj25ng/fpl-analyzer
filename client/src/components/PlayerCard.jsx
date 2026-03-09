import { getRatingClass } from "../utils/ratings";

export default function PlayerCard({
  player,
  displayPoints,
  mode = "points",
  onSelect,
}) {
  const isReport = mode === "report";
  const ratingValue = player.rating ?? null;
  const ratingClass = isReport && ratingValue !== null ? getRatingClass(ratingValue) : "";
  const pointsLabel = isReport
    ? player.ratingGrade ?? (ratingValue === null ? "..." : `${ratingValue}`)
    : `${displayPoints} pts`;
  const playerLabel = `${player.name}${player.teamShortName ? ` (${player.teamShortName})` : ""}`;
  const leftLabel = isReport ? player.fixtureLabel : `£${player.price}`;
  const rightLabel = isReport
    ? `xP ${(player.expectedPoints ?? 0).toFixed(1)}`
    : `${player.selectedBy.toFixed(1)}%`;
  const fixtureClass = isReport ? `fixture-diff-${player.fixtureDifficulty}` : "";

  return (
    <button className="player-card" type="button" onClick={onSelect}>
      <div className="player-row player-name-row">
        <span>
          {playerLabel}{" "}
          {player.isCaptain ? (
            <span title="Captain">©</span>
          ) : player.isVice ? (
            <span title="Vice Captain">Ⓥ</span>
          ) : null}
        </span>
      </div>
      <div className={`player-row player-points-row ${ratingClass}`.trim()}>
        {pointsLabel}
      </div>
      <div className="player-row player-bottom-row">
        <div className={`player-price ${fixtureClass}`.trim()}>{leftLabel}</div>
        <div className="player-owned">{rightLabel}</div>
      </div>
    </button>
  );
}
