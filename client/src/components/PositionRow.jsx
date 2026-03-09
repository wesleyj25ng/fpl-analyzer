import PlayerCard from "./PlayerCard";

export default function PositionRow({
  players,
  className = "",
  style,
  getDisplayPoints,
  mode,
  onSelectPlayer,
}) {
  if (!players || players.length === 0) return null;

  return (
    <section className={`position-group ${className}`.trim()} style={style}>
      <div
        className="player-grid"
        style={{ gridTemplateColumns: `repeat(${players.length}, var(--card-width))` }}
      >
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            displayPoints={getDisplayPoints(player)}
            mode={mode}
            onSelect={() => onSelectPlayer?.(player)}
          />
        ))}
      </div>
    </section>
  );
}
