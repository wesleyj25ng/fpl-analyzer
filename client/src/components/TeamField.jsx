import PositionRow from "./PositionRow";

export default function TeamField({
  grouped,
  squad,
  fieldOuterWidth,
  mode,
  onSelectPlayer,
}) {
  if (mode === "report") {
    return (
      <div className="team-field report-mode" style={{ width: fieldOuterWidth }}>
        <div className="positions">
          {["GKP", "DEF", "MID", "FWD"].map((pos) => {
            const starters = grouped[pos];
            return (
              <PositionRow
                key={pos}
                  players={starters}
                  getDisplayPoints={(player) =>
                    player.isCaptain ? player.points * player.multiplier : player.points
                  }
                  mode="report"
                  onSelectPlayer={onSelectPlayer}
                />
              );
            })}
          </div>
      </div>
    );
  }

  const showBench = squad.some((p) => p.multiplier === 0);

  return (
    <>
      <div className="team-field" style={{ width: fieldOuterWidth }}>
        <div className="positions">
          {["GKP", "DEF", "MID", "FWD"].map((pos) => {
            const starters = grouped[pos].filter((p) => p.multiplier > 0);
            return (
              <PositionRow
                key={pos}
                  players={starters}
                  getDisplayPoints={(player) =>
                    player.isCaptain ? player.points * player.multiplier : player.points
                  }
                  mode="points"
                  onSelectPlayer={onSelectPlayer}
                />
              );
            })}
          </div>
      </div>
      {showBench && (
        <>
          <div className="bench-divider" aria-hidden="true" />
          <PositionRow
            className="position-bench"
            style={{ width: fieldOuterWidth }}
            players={squad
              .filter((p) => p.multiplier === 0)
              .slice()
              .sort((a, b) => a.pickPosition - b.pickPosition)}
            getDisplayPoints={(player) => player.points}
            mode="points"
            onSelectPlayer={onSelectPlayer}
          />
        </>
      )}
    </>
  );
}
