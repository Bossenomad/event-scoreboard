# Google Drive CSV setup

Appen lagrar nu scoreboard-data i en CSV-fil i Google Drive.

## 1) Skapa Service Account
1. Gå till Google Cloud Console
2. Skapa ett projekt (eller använd befintligt)
3. Enable: **Google Drive API**
4. Skapa en **Service Account**
5. Skapa en JSON-nyckel för service account

Du behöver:
- `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` -> `GOOGLE_PRIVATE_KEY`

## 2) Skapa CSV-fil i Google Drive
1. Skapa en tom fil i Drive, t.ex. `event-scoreboard.csv`
2. Dela filen med service account email (Editor)
3. Kopiera filens ID från URL och sätt som:
   - `GOOGLE_DRIVE_FILE_ID`

## 3) Environment variables (Vercel)
Sätt dessa i Vercel Project Settings -> Environment Variables:

- `GOOGLE_DRIVE_FILE_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GDPR_RETENTION_DAYS` (valfritt, t.ex. `30`)
- `PENDING_TOP_TOKEN_TTL_MINUTES` (valfritt, t.ex. `30`)

Tips: `GOOGLE_PRIVATE_KEY` ska innehålla radbrytningar som `\n` i Vercel. Koden konverterar det automatiskt.

## 4) Deploy
Pusha till GitHub och deploya om i Vercel.

## 5) Verifiera
- `/staff/` ska kunna registrera score
- `/tv/` ska visa uppdaterad data
