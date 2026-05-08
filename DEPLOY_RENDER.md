# Deploy till Render (stabil single-server)

Detta upplägg ger en enda server-instans + persistent disk. Då blir Staff och TV synkade stabilt.

## 1) Pushad kod
Repo har `render.yaml` och använder:
- `SCOREBOARD_DATA_PATH=/var/data/scoreboard.json`
- persistent disk monterad på `/var/data`

## 2) Skapa tjänst i Render
1. Gå till Render Dashboard
2. New + > Blueprint
3. Välj GitHub-repot `Bossenomad/event-scoreboard`
4. Deploy

Render läser `render.yaml` automatiskt.

## 3) Efter deploy
- Öppna URL från Render
- Staff: `/staff/`
- TV: `/tv/`

## 4) Viktigt
- Kör bara en aktiv web service för detta event om ni vill ha helt konsekvent lokal fil-lagring.
- Vercel serverless passar sämre för denna filbaserade realtidslogik.
