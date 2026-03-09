# FPL Analyzer

FPL Analyzer is a small full-stack app for analyzing a Fantasy Premier League team.

It has two parts:

- `client/`: React + Vite frontend
- `server/`: Express proxy for the public FPL API

## Repo Layout

```text
fpl-analyzer/
  client/
  server/
  README.md
```

## Running Locally

Start the API proxy:

```bash
cd server
npm install
npm start
```

Start the frontend in a second terminal:

```bash
cd client
npm install
npm run dev
```

The frontend expects the proxy to be running on `http://localhost:3001`.

## Frontend Commands

```bash
cd client
npm run dev
npm run build
npm run lint
```

## Backend Commands

```bash
cd server
npm start
```

## What It Does

- loads a manager's current squad from FPL
- scores the squad with a custom report view
- shows player detail cards with historical xP vs actual points
- lets you search for players outside your squad

## Notes

- the player card xP uses FPL's official `ep_next` / `ep_this` fields
- the historical chart xP is a local approximation derived from match expected stats
