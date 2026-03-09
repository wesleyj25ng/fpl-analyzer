import PlayerCard from "./PlayerCard";

export default function PlayerSearchPanel({
  searchTerm,
  onSearchChange,
  players,
  onSelectPlayer,
}) {
  return (
    <section className="player-search-panel">
      <div className="player-search-header">
        <div className="player-search-title">Search Players</div>
        <div className="player-search-copy">Find players outside your current squad.</div>
      </div>
      <input
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search any player"
        className="player-search-input"
      />
      {searchTerm.trim() && (
        <div className="player-search-results">
          {players.length ? (
            <div
              className="player-grid player-search-grid"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(var(--card-width), var(--card-width)))",
              }}
            >
              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  displayPoints={player.rating ?? 0}
                  mode="report"
                  onSelect={() => onSelectPlayer(player.id)}
                />
              ))}
            </div>
          ) : (
            <div className="player-search-empty">No matching non-squad players found.</div>
          )}
        </div>
      )}
    </section>
  );
}
