# Implementation Plan: Event Scoreboard

## Overview

Build a real-time event scoreboard web application using Node.js, Express, TypeScript, SQLite, and WebSocket. The implementation proceeds from project setup and data layer through service logic, REST API, WebSocket broadcasting, and three frontend interfaces (Registration Form, Staff Interface, TV Display). Each task builds incrementally so the application is functional at each checkpoint.

## Tasks

- [x] 1. Set up project structure and configuration
  - Initialize Node.js project with TypeScript
  - Install dependencies: express, better-sqlite3, ws, uuid, qrcode
  - Install dev dependencies: typescript, vitest, fast-check, supertest, @types/*
  - Configure tsconfig.json for Node.js with ES modules
  - Configure vitest.config.ts
  - Create directory structure: src/, src/routes/, src/services/, src/db/, src/validation/, public/, public/register/, public/staff/, public/tv/
  - Create a basic Express server entry point (src/server.ts) that listens on a configurable port
  - _Requirements: 8.1_

- [x] 2. Implement database schema and data access layer
  - [x] 2.1 Create database initialization module
    - Create src/db/database.ts that initializes SQLite via better-sqlite3
    - Create players and scores tables per the design schema (with ON DELETE CASCADE)
    - Create idx_scores_player_id index
    - Auto-create the database file if missing on startup
    - _Requirements: 7.1, 7.2_

  - [x] 2.2 Create data access functions
    - Implement insertPlayer, getAllPlayers, getPlayerById, deletePlayer
    - Implement insertScore, getScoresByPlayerId
    - Implement getLeaderboard (top 5 by max score per player, descending)
    - Implement getPrizePot (SUM of all scores)
    - _Requirements: 7.1, 5.1, 5.5_

  - [ ]* 2.3 Write property test for data persistence round-trip (Property 7)
    - **Property 7: Player and score data persistence round-trip**
    - Generate random valid player registrations and scores; persist and retrieve; verify round-trip equality
    - **Validates: Requirements 7.1**

  - [ ]* 2.4 Write property test for player deletion (Property 8)
    - **Property 8: Player deletion removes all associated data**
    - Generate random players with scores; delete a player; verify removal from player list, prize pot, and leaderboard
    - **Validates: Requirements 9.4**

- [x] 3. Implement validation module
  - [x] 3.1 Create player registration validation
    - Create src/validation/validation.ts with validatePlayerRegistration function
    - Validate displayName: required, 1–50 chars, trimmed
    - Validate favouriteClub: required, 1–100 chars, trimmed
    - Validate email: optional; if provided, must match email regex
    - Validate emailConsent: required and true if email is provided
    - Return ValidationResult with per-field error messages
    - _Requirements: 1.7, 1.8, 1.9, 9.5, 9.6_

  - [x] 3.2 Create score entry validation
    - Implement validateScoreEntry function in the same module
    - Validate playerId: required, valid UUID format
    - Validate score: required, positive integer (> 0)
    - Return ValidationResult with per-field error messages
    - _Requirements: 2.5, 2.6_

  - [ ]* 3.3 Write property test for registration validation — missing required fields (Property 1)
    - **Property 1: Registration validation rejects missing required fields**
    - Generate random registrations with empty/whitespace displayName or favouriteClub; verify validation rejects with correct field errors
    - **Validates: Requirements 1.7**

  - [ ]* 3.4 Write property test for registration validation — email without consent (Property 2)
    - **Property 2: Registration validation rejects email without consent**
    - Generate random registrations with non-empty email but emailConsent false/undefined; verify validation rejects with consent error
    - **Validates: Requirements 1.8, 9.5**

  - [ ]* 3.5 Write property test for registration validation — invalid email format (Property 3)
    - **Property 3: Registration validation rejects invalid email formats**
    - Generate random invalid email strings; verify validation rejects with email error
    - **Validates: Requirements 1.9**

  - [ ]* 3.6 Write property test for score validation — non-positive values (Property 5)
    - **Property 5: Score validation rejects non-positive values**
    - Generate random non-positive numbers (zero, negative, non-integer); verify score validation rejects with score error
    - **Validates: Requirements 2.6**

- [x] 4. Implement service layer
  - [x] 4.1 Create scoreboard service
    - Create src/services/scoreboardService.ts implementing the ScoreboardService interface
    - Implement registerPlayer: validate input, insert player, return Player record (without email in response)
    - Implement getPlayers: return all registered players
    - Implement recordScore: validate input, verify player exists, insert score, return ScoreRecord
    - Implement getScoreboardState: return current prizePot and leaderboard (top 5)
    - Implement deletePlayer: delete player and cascade-delete scores, return success boolean
    - _Requirements: 1.10, 2.1, 2.3, 5.1, 9.4_

  - [ ]* 4.2 Write property test for valid registration creating matching player record (Property 4)
    - **Property 4: Valid registration creates a matching player record**
    - Generate random valid registrations; verify created Player record matches input displayName and favouriteClub
    - **Validates: Requirements 1.10**

  - [ ]* 4.3 Write property test for leaderboard ordering and size (Property 6)
    - **Property 6: Leaderboard returns correct top N players in descending order**
    - Generate random sets of players with scores; verify leaderboard has at most 5 entries, sorted descending by score, with correct player data
    - **Validates: Requirements 5.1, 5.2, 5.5**

- [x] 5. Checkpoint — Verify data layer and service logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement REST API endpoints
  - [x] 6.1 Create player registration endpoint
    - Create src/routes/players.ts with POST /api/players route
    - Parse request body, call validation, call service registerPlayer
    - Return 201 with player data (excluding email) on success, 400 with field errors on validation failure
    - _Requirements: 1.10, 1.7, 1.8, 1.9_

  - [x] 6.2 Create player list endpoint
    - Add GET /api/players route returning all registered players
    - _Requirements: 1.11_

  - [x] 6.3 Create score entry endpoint
    - Create src/routes/scores.ts with POST /api/scores route
    - Parse request body, call validation, call service recordScore
    - On success, trigger WebSocket broadcast of updated scoreboard state
    - Return 201 with score data on success, 400 on validation failure, 404 if player not found
    - _Requirements: 2.3, 2.7, 3.2_

  - [x] 6.4 Create scoreboard state endpoint
    - Add GET /api/scoreboard route returning current prizePot and leaderboard
    - _Requirements: 3.4, 4.3, 5.1_

  - [x] 6.5 Create player deletion endpoint
    - Add DELETE /api/players/:id route
    - Call service deletePlayer, trigger WebSocket broadcast of updated state
    - Return 204 on success, 404 if player not found
    - _Requirements: 9.4_

  - [x] 6.6 Wire routes into Express server
    - Register all route handlers in src/server.ts
    - Add JSON body parsing middleware
    - Serve static files from public/ directory
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Implement WebSocket server
  - [x] 7.1 Create WebSocket server module
    - Create src/services/websocketServer.ts
    - Attach ws WebSocket server to the Express HTTP server on path /ws
    - On new client connection, send current scoreboard state as initial message
    - Implement broadcast function to send updated state to all connected clients
    - Handle connection errors gracefully (log and continue)
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 7.2 Integrate WebSocket broadcast with score entry and player deletion
    - After recordScore succeeds, broadcast updated scoreboard state
    - After deletePlayer succeeds, broadcast updated scoreboard state
    - _Requirements: 3.2_

- [x] 8. Implement QR code generation
  - Create src/services/qrCodeService.ts
  - Generate QR code as SVG/data URL at server startup using the qrcode npm package
  - QR code encodes the registration form URL (configurable base URL + /register)
  - Expose GET /api/qrcode endpoint returning the QR code image
  - Fallback: if QR generation fails, log error and serve the URL as plain text
  - _Requirements: 1.1, 1.2_

- [x] 9. Checkpoint — Verify API and WebSocket functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Build Registration Form frontend
  - [x] 10.1 Create registration page HTML and CSS
    - Create public/register/index.html with mobile-optimized responsive layout
    - Form fields: display name (required), favourite club (required), email (optional), consent checkbox
    - Consent checkbox only visible when email field is non-empty
    - Display data retention notice and privacy explanation below the form
    - Clearly mark email as optional with explanation text ("so we can contact you if you win a prize")
    - Ensure consent checkbox is NOT pre-checked
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 9.1, 9.2, 9.3, 9.5, 9.6, 9.7_

  - [x] 10.2 Add registration form client-side logic
    - Create public/register/app.js
    - Client-side validation mirroring server-side rules (required fields, email format, consent)
    - Display field-level validation errors
    - Submit form via POST /api/players
    - Show success confirmation screen after registration
    - _Requirements: 1.7, 1.8, 1.9, 1.10_

- [x] 11. Build Staff Interface frontend
  - [x] 11.1 Create staff interface HTML and CSS
    - Create public/staff/index.html optimized for tablet/laptop
    - Player dropdown/search populated from GET /api/players
    - Score input field (numeric)
    - Confirmation screen overlay showing player name + score with Confirm/Cancel buttons
    - _Requirements: 2.1, 2.2_

  - [x] 11.2 Add staff interface client-side logic
    - Create public/staff/app.js
    - Fetch and populate player list from GET /api/players
    - Client-side validation: require player selection and positive integer score
    - On submit, show confirmation screen with player name and score
    - On confirm, POST /api/scores and show success feedback
    - On cancel, return to form with previously entered values preserved
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 12. Build TV Display frontend
  - [x] 12.1 Create TV display HTML and CSS
    - Create public/tv/index.html with full-screen 1920×1080 layout
    - Dark background, high-contrast colours, large fonts readable from 5+ metres
    - Layout showing prize pot and leaderboard simultaneously on a single screen
    - Leaderboard shows top 5 rows with rank, name, club, score
    - _Requirements: 6.1, 6.2, 6.3, 4.1, 5.1, 5.2_

  - [x] 12.2 Add TV display client-side logic
    - Create public/tv/app.js
    - Establish WebSocket connection to ws://<host>/ws
    - On initial state message, render prize pot and leaderboard
    - Prize pot count-up animation using requestAnimationFrame (~1.5 second interpolation)
    - Leaderboard CSS transitions for position changes and slide-in animation for new entries
    - Implement exponential backoff reconnection (1s → 2s → 4s → 8s → max 30s)
    - Fallback: poll GET /api/scoreboard every 5 seconds if WebSocket unavailable
    - _Requirements: 3.1, 3.3, 4.1, 4.2, 4.3, 5.1, 5.3, 5.4, 5.5_

- [x] 13. Checkpoint — Verify full application end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 14. Write integration tests
  - [ ]* 14.1 Write integration test for registration → staff flow
    - Register a player via POST /api/players, verify they appear in GET /api/players
    - _Requirements: 1.10, 1.11_

  - [ ]* 14.2 Write integration test for score entry → WebSocket broadcast
    - Register a player, connect a WebSocket client, save a score via POST /api/scores, verify WebSocket client receives updated state
    - _Requirements: 2.3, 2.7, 3.2_

  - [ ]* 14.3 Write integration test for WebSocket initial state
    - Add players and scores, connect a WebSocket client, verify it receives correct prizePot and leaderboard
    - _Requirements: 3.4_

  - [ ]* 14.4 Write integration test for GDPR deletion flow
    - Register a player, add scores, delete player via DELETE /api/players/:id, verify removal from player list, prize pot, and leaderboard
    - _Requirements: 9.4_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The application is a single Node.js process serving all three interfaces — no separate frontend build step required
