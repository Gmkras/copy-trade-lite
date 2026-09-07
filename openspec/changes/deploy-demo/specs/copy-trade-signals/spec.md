## REMOVED Requirements

### Requirement: Signals are persisted locally and survive restarts
**Reason**: It ties the guarantee to "a local SQLite database file at `DB_PATH`", which stops being true once the app runs on a serverless platform whose filesystem is discarded between invocations. Replaced below by a requirement that states the durability guarantee without naming where the bytes live.
**Migration**: None for a local clone: the successor still uses a `file:` URL by default and the same schema, so an existing `data/signals.db` keeps working. A deployment points `DATABASE_URL` at a remote libSQL database instead.

## ADDED Requirements

### Requirement: Signals and copies are stored durably
The system SHALL store every posted signal and every copy in a SQL database identified by `DATABASE_URL`, creating the schema on first use, and SHALL read them back after the process restarts or is redeployed. Locally the URL SHALL default to a file in `data/`, which is excluded from version control; in a deployment it SHALL point at a remote database and MAY require `DATABASE_AUTH_TOKEN`. No signal data SHALL be committed to the repository.

#### Scenario: Restart keeps history
- **GIVEN** two signals have been posted
- **WHEN** the server is restarted and `GET /api/signals` is called
- **THEN** both signals are returned with their copies and counts

#### Scenario: First use creates the schema
- **GIVEN** an empty database
- **WHEN** the first signal is posted
- **THEN** the tables are created and the signal is stored; no manual migration step is needed

#### Scenario: Redeploy keeps history
- **GIVEN** the app is deployed with a remote `DATABASE_URL` and signals exist
- **WHEN** a new version is deployed
- **THEN** the feed still lists those signals with their copies

#### Scenario: Unreachable database
- **GIVEN** `DATABASE_URL` points at a database that cannot be reached
- **WHEN** the feed is opened
- **THEN** the screen explains in plain language that the ideas could not be loaded, and no stack trace or connection string is shown
