# Readwise

## Run locally

```bash
cp .env.example .env
# put your GROQ_API_KEY in .env
./start.sh
```

Open http://localhost:5173

## Run continuously with Docker

Set `GROQ_API_KEY` in `.env`, then run:

```bash
docker compose up -d --build
```

Open http://localhost:18743. The web app, API, and database use `restart: unless-stopped`, so they automatically come back after a Docker or machine restart. Change `APP_PORT` in `.env` if you want a different host port.

## Other commands

```bash
npm run dev      # start client + server (pushes schema first)
npm test         # sentence extraction + lookup validation tests
npm run build    # typecheck and build both apps
docker compose up -d --build   # start the full app
```
