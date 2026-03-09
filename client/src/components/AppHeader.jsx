export default function AppHeader({
  activeTab,
  onChangeTab,
  overallScore,
  teamName,
  managerName,
  eventId,
}) {
  return (
    <>
      <div className="top-tabs">
        <button
          className={`tab-button ${
            activeTab === "report" ? "is-active" : ""
          }`.trim()}
          type="button"
          onClick={() => onChangeTab("report")}
        >
          Report
        </button>
        <span className="tab-separator">|</span>
        <button
          className={`tab-button ${
            activeTab === "search" ? "is-active" : ""
          }`.trim()}
          type="button"
          onClick={() => onChangeTab("search")}
        >
          Search
        </button>
      </div>

      {activeTab === "report" && (
        <div className="score-header">
          <div className="score-title">Overall Score:</div>
          <div className="score-box">{overallScore}/100</div>
          <div className="score-meta">
            {teamName}
            {managerName ? ` · ${managerName}` : ""} · Gameweek {eventId ?? "X"}
          </div>
        </div>
      )}

      {activeTab === "search" && (
        <div className="score-header">
          <div className="score-title">Looking for a differential pick?</div>
        </div>
      )}
    </>
  );
}
