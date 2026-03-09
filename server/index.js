import express from "express";
import cors from "cors";

const app = express();
// Local proxy exists to avoid browser CORS issues against the public FPL API.
app.use(cors());

const PORT = 3001;

// Proxies the large bootstrap dataset used to hydrate teams, players, and events.
app.get("/api/bootstrap-static", async (req, res) => {
  const r = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  res.status(r.status).send(await r.text());
});

// Proxies the global fixture list used for current and upcoming opponent lookups.
app.get("/api/fixtures", async (req, res) => {
  const r = await fetch("https://fantasy.premierleague.com/api/fixtures/");
  res.status(r.status).send(await r.text());
});

// Proxies a manager record by entry id.
app.get("/api/entry/:entryId", async (req, res) => {
  const { entryId } = req.params;
  const url = `https://fantasy.premierleague.com/api/entry/${entryId}/`;
  const r = await fetch(url);
  res.status(r.status).send(await r.text());
});

// Proxies one manager's picks for a single gameweek.
app.get("/api/entry/:entryId/event/:gw/picks", async (req, res) => {
  const { entryId, gw } = req.params;
  const url = `https://fantasy.premierleague.com/api/entry/${entryId}/event/${gw}/picks/`;
  const r = await fetch(url);
  res.status(r.status).send(await r.text());
});

// Proxies detailed history for a single player.
app.get("/api/element-summary/:id", async (req, res) => {
  const { id } = req.params;
  const url = `https://fantasy.premierleague.com/api/element-summary/${id}/`;
  const r = await fetch(url);
  res.status(r.status).send(await r.text());
});

// Starts the proxy used by the frontend API client.
app.listen(PORT, () => {
  console.log("Server running on http://localhost:3001");
});
