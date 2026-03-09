function buildLinePath(values, xStart, yBase, width, height, maxValue) {
  if (!values.length) return "";
  if (values.length === 1) {
    const y = yBase - (values[0] / maxValue) * height;
    return `M ${xStart} ${y} L ${xStart + width} ${y}`;
  }

  return values
    .map((value, index) => {
      const x = xStart + (index / (values.length - 1)) * width;
      const y = yBase - (value / maxValue) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default function PlayerDetail({ player, onClose }) {
  if (!player) return null;

  const recentChart = player.recentChart ?? [];
  const chartLeft = 12;
  const chartRight = 156;
  const chartTop = 8;
  const chartBottom = 82;
  const plotWidth = chartRight - chartLeft;
  const plotHeight = chartBottom - chartTop;
  const chartMax = Math.max(
    8,
    ...recentChart.flatMap((point) => [point.actualPoints ?? 0, point.expectedPoints ?? 0])
  );
  const yTicks = [0, chartMax / 2, chartMax].map((value) => Number(value.toFixed(1)));
  const actualPath = buildLinePath(
    recentChart.map((point) => point.actualPoints ?? 0),
    chartLeft,
    chartBottom,
    plotWidth,
    plotHeight,
    chartMax
  );
  const expectedPath = buildLinePath(
    recentChart.map((point) => point.expectedPoints ?? 0),
    chartLeft,
    chartBottom,
    plotWidth,
    plotHeight,
    chartMax
  );

  return (
    <div className="player-detail-overlay" role="dialog" aria-modal="true">
      <section className="player-detail">
        <button
          className="player-detail-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="player-detail-header">
          <div>
            <div className="player-detail-name">{player.name}</div>
            <div className="player-detail-meta">
              {player.position} · £{player.price}M · {player.teamShortName || player.teamId}
            </div>
          </div>
        </div>

      <div className="player-detail-grid">
        <div className="player-detail-card">
          <div className="detail-label">Rating</div>
          <div className="detail-value">{player.rating}/100</div>
        </div>
        <div className="player-detail-card">
          <div className="detail-label">Points Per Game</div>
          <div className="detail-value">{player.points_per_game}</div>
        </div>
        <div className="player-detail-card">
          <div className="detail-label">Form (Last 4 Played)</div>
          <div className="detail-value">{player.recentForm?.toFixed?.(2) ?? "0.00"}</div>
        </div>
        <div className="player-detail-card">
          <div className="detail-label">Ownership</div>
          <div className="detail-value">{player.selectedBy?.toFixed?.(1) ?? "0.0"}%</div>
        </div>
        <div className="player-detail-card">
          <div className="detail-label">Nailedness</div>
          <div className="detail-value">{Math.round((player.nailedRate ?? 0) * 100)}%</div>
        </div>
      </div>

      <div className="player-detail-section">
        <div className="detail-label">Expected vs Actual Points (Last 6 Gameweeks)</div>
        {recentChart.length ? (
          <div className="xp-chart">
            <div className="xp-chart-legend" aria-hidden="true">
              <span className="xp-legend-item">
                <span className="xp-legend-swatch xp-legend-swatch-expected" />
                xP
              </span>
              <span className="xp-legend-item">
                <span className="xp-legend-swatch xp-legend-swatch-actual" />
                Actual
              </span>
            </div>
            <svg
              className="xp-chart-svg"
              viewBox="0 0 160 100"
              role="img"
              aria-label={`Expected points versus actual points for ${player.name}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {yTicks.map((tick) => {
                const y = chartBottom - (tick / chartMax) * plotHeight;
                return (
                  <g key={`${player.id}-tick-${tick}`}>
                    <line
                      className="xp-chart-grid-line"
                      x1={chartLeft}
                      y1={y}
                      x2={chartRight}
                      y2={y}
                    />
                    <text className="xp-chart-axis-text xp-chart-y-text" x={chartLeft - 2} y={y}>
                      {tick}
                    </text>
                  </g>
                );
              })}
              <line className="xp-chart-axis" x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} />
              <line className="xp-chart-axis" x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} />
              <path className="xp-chart-line xp-chart-line-expected" d={expectedPath} />
              <path className="xp-chart-line xp-chart-line-actual" d={actualPath} />
              {recentChart.map((point, index) => {
                const x =
                  recentChart.length === 1
                    ? chartLeft + plotWidth / 2
                    : chartLeft + (index / (recentChart.length - 1)) * plotWidth;
                const actualY = chartBottom - ((point.actualPoints ?? 0) / chartMax) * plotHeight;
                const expectedY =
                  chartBottom - ((point.expectedPoints ?? 0) / chartMax) * plotHeight;

                return (
                  <g key={`${player.id}-chart-${index}`}>
                    <circle className="xp-chart-dot xp-chart-dot-expected" cx={x} cy={expectedY} r="1.5" />
                    <circle className="xp-chart-dot xp-chart-dot-actual" cx={x} cy={actualY} r="1.5" />
                    <text className="xp-chart-axis-text xp-chart-x-text" x={x} y={chartBottom + 6}>
                      {point.label}
                    </text>
                  </g>
                );
              })}
              <text className="xp-chart-axis-label" x={(chartLeft + chartRight) / 2} y="95">
                Gameweek
              </text>
              <text
                className="xp-chart-axis-label"
                x="3"
                y={(chartTop + chartBottom) / 2}
                transform={`rotate(-90 3 ${(chartTop + chartBottom) / 2})`}
              >
                Points
              </text>
            </svg>
          </div>
        ) : (
          <div className="recent-empty">No recent games.</div>
        )}
      </div>

      </section>
    </div>
  );
}
