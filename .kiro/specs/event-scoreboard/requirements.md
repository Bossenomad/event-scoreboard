# Requirements Document

## Introduction

A live event scoreboard web application for physical hockey activations. The app powers two interfaces: a **Staff Interface** used on a tablet or laptop for score entry, and a **TV Display** shown on a large screen at the event venue. Players register themselves by scanning a **QR code** displayed at the event station, which opens a registration form on their own phone. After registration, event staff manually enter scores following each 30-second session on physical hockey training equipment. The TV Display shows a prize pot that animates upward as total points accumulate across all players, and a top-5 leaderboard with animated transitions when new high scorers appear.

## Glossary

- **Staff_Interface**: The web-based interface used by event staff on a tablet or laptop to view registered players and enter scores.
- **TV_Display**: The web-based interface rendered in a browser on a large TV screen at the event venue, showing the prize pot and leaderboard.
- **Application**: The complete event scoreboard system, including the Server, Staff_Interface, and TV_Display, packaged for deployment as a hosted web application.
- **Player**: A person who registers at the event via the QR code registration form, plays a 30-second session, and receives a score.
- **Score**: An integer value representing the points a player earned during a single 30-second session.
- **Prize_Pot**: A running total of all points scored by all players across the entire event, displayed with a count-up animation on the TV_Display.
- **Leaderboard**: A ranked list of the top 5 players by score, displayed on the TV_Display.
- **Session**: A single 30-second play period on the physical hockey equipment.
- **Favourite_Club**: The hockey club a player selects as their favourite during registration.
- **WebSocket_Connection**: A persistent, bidirectional communication channel between the server and the TV_Display client, used for real-time updates.
- **Confirmation_Screen**: An intermediate review screen in the Staff_Interface that displays the Player name and Score for staff approval before the score is saved.
- **QR_Code**: A scannable QR code displayed at the event station that links to the player registration form URL, allowing players to register themselves on their own phone.
- **Registration_Form**: The web-based form accessed via the QR_Code on a player's own phone, used for self-service player registration.

## Requirements

### Requirement 1: Player Registration

**User Story:** As a player at the event, I want to register myself by scanning a QR code on my phone, so that I can quickly sign up and appear in the staff's player list for score entry.

#### Acceptance Criteria

1. THE Application SHALL display a QR_Code at the event station that links to the Registration_Form URL.
2. WHEN a Player scans the QR_Code, THE Registration_Form SHALL open in the Player's mobile browser.
3. THE Registration_Form SHALL provide required fields for display name and Favourite_Club.
4. THE Registration_Form SHALL provide an optional email field, clearly marked as optional, with an explanation such as "so we can contact you if you win a prize".
5. WHEN a Player provides an email address, THE Registration_Form SHALL display an active consent checkbox that the Player must check before submitting.
6. THE Registration_Form SHALL NOT display a pre-checked consent checkbox.
7. IF a registration form is submitted with any required field empty, THEN THE Registration_Form SHALL display a validation error indicating which fields are missing.
8. IF a registration form is submitted with an email address but without the consent checkbox checked, THEN THE Registration_Form SHALL display a validation error requesting consent.
9. IF a registration form is submitted with an invalid email format, THEN THE Registration_Form SHALL display a validation error for the email field.
10. WHEN a Player submits a completed Registration_Form, THE Application SHALL create a new Player record and confirm successful registration to the Player.
11. WHEN a new Player record is created, THE Staff_Interface SHALL display the Player in the registered player list available for score entry.

### Requirement 2: Score Entry

**User Story:** As event staff, I want to manually enter a player's score after their session and confirm it before it goes live, so that the score is accurately recorded and reflected on the TV display.

#### Acceptance Criteria

1. THE Staff_Interface SHALL provide a score entry form that allows event staff to select a registered Player and enter their Score.
2. WHEN event staff submit a score, THE Staff_Interface SHALL display a confirmation screen showing the selected Player name and the entered Score for staff review before saving.
3. WHEN event staff approve the score on the confirmation screen, THE Staff_Interface SHALL save the Score and confirm successful entry.
4. WHEN event staff reject the score on the confirmation screen, THE Staff_Interface SHALL return to the score entry form with the previously entered values preserved.
5. IF a score is submitted without selecting a Player, THEN THE Staff_Interface SHALL display a validation error requesting Player selection.
6. IF a score is submitted with a non-positive integer value, THEN THE Staff_Interface SHALL display a validation error requesting a valid score.
7. WHEN a Score is successfully saved, THE Staff_Interface SHALL send the updated data to the server for real-time broadcast.

### Requirement 3: Real-Time Communication

**User Story:** As the system operator, I want the TV display to receive score updates in real time, so that the audience sees changes immediately without manual refresh.

#### Acceptance Criteria

1. THE Server SHALL maintain a WebSocket_Connection with each connected TV_Display client.
2. WHEN a new Score is saved, THE Server SHALL broadcast the updated Prize_Pot total and Leaderboard data to all connected TV_Display clients via the WebSocket_Connection.
3. IF a WebSocket_Connection is lost, THEN THE TV_Display SHALL attempt to reconnect automatically.
4. WHEN a TV_Display client establishes a WebSocket_Connection, THE Server SHALL send the current Prize_Pot total and Leaderboard data as an initial state.

### Requirement 4: Prize Pot Display

**User Story:** As an event attendee, I want to see a prize pot that visually counts up as players score points, so that the event feels exciting and dynamic.

#### Acceptance Criteria

1. THE TV_Display SHALL display the Prize_Pot as a prominently visible numeric value.
2. WHEN the TV_Display receives an updated Prize_Pot total, THE TV_Display SHALL animate the displayed value counting up from the previous total to the new total.
3. WHEN the TV_Display first loads, THE TV_Display SHALL display the current Prize_Pot total received from the Server.

### Requirement 5: Top 5 Leaderboard Display

**User Story:** As an event attendee, I want to see the top 5 highest-scoring players on the TV, so that I know who is leading the competition.

#### Acceptance Criteria

1. THE TV_Display SHALL display a Leaderboard showing the top 5 Players ranked by Score in descending order.
2. THE Leaderboard SHALL display each Player's name, Favourite_Club, and Score.
3. WHEN a new Score causes a Player to enter the top 5, THE TV_Display SHALL animate the new Player's entry onto the Leaderboard.
4. WHEN a new Score causes a ranking change among existing top 5 Players, THE TV_Display SHALL animate the position changes.
5. IF fewer than 5 Players have been scored, THEN THE TV_Display SHALL display only the Players who have scores.

### Requirement 6: TV Display Layout

**User Story:** As the system operator, I want the TV display to be visually polished and suitable for a large screen, so that it looks professional at the event venue.

#### Acceptance Criteria

1. THE TV_Display SHALL render in a full-screen browser layout optimized for 1920x1080 resolution.
2. THE TV_Display SHALL display both the Prize_Pot and the Leaderboard simultaneously on a single screen.
3. THE TV_Display SHALL use high-contrast colours and large fonts readable from a distance of at least 5 metres.

### Requirement 7: Data Persistence

**User Story:** As the system operator, I want player and score data to persist across server restarts, so that event data is not lost if the application restarts.

#### Acceptance Criteria

1. THE Server SHALL persist all Player records and Score records to a data store.
2. WHEN the Server starts, THE Server SHALL load existing Player records and Score records from the data store.
3. WHEN the TV_Display connects after a Server restart, THE TV_Display SHALL display the correct Prize_Pot total and Leaderboard based on persisted data.

### Requirement 8: Hosted Web Application Deployment

**User Story:** As the system operator, I want the application to be a hosted web application accessible via URL, so that the TV Display can be loaded on any browser-equipped screen at the venue without local installation.

#### Acceptance Criteria

1. THE Application SHALL be deployable as a hosted web application on common cloud platforms.
2. THE TV_Display SHALL be accessible via a URL in any modern web browser without requiring local software installation.
3. THE Staff_Interface SHALL be accessible via a URL in any modern web browser on a tablet or laptop.
4. WHEN a TV screen's browser navigates to the TV_Display URL, THE TV_Display SHALL load and begin displaying the Prize_Pot and Leaderboard.

### Requirement 9: GDPR and Privacy Compliance

**User Story:** As a player, I want my personal data to be handled responsibly and transparently, so that I can trust the event with my information and participate with confidence.

#### Acceptance Criteria

1. THE Application SHALL collect only the minimum data necessary for event participation: display name and Favourite_Club as required fields, and email as an optional field.
2. THE Registration_Form SHALL display a data retention notice informing the Player how long their data will be kept.
3. THE Registration_Form SHALL clearly state that email is optional and that Players can participate fully without providing an email address.
4. THE Application SHALL provide a mechanism for Players to request deletion of their personal data.
5. WHEN a Player provides an email address, THE Registration_Form SHALL require active consent via an unchecked checkbox before the form can be submitted.
6. THE Registration_Form SHALL NOT use pre-checked consent checkboxes.
7. THE Registration_Form SHALL display a clear explanation of how the Player's data will be processed and for what purposes.
