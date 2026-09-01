# Implementation Roadmap (Node.js Application)

This roadmap outlines the Software Development Lifecycle (SDLC) for building the custom-coded Patient Intake Backend.

## Phase 1: Environment & Authentication Setup (Days 1-2)
*   [ ] **Initialize Repository:** Set up the Node.js project with `npm init`, configure `tsconfig.json`, and install core dependencies (`googleapis`, `@google/generative-ai`, `axios`, `node-cron`, `dotenv`).
*   [ ] **Google Cloud Console Setup:** Create a GCP project, enable Gmail, Docs, and Sheets APIs. Generate a Service Account or OAuth 2.0 credentials for secure server-to-server authentication.
*   [ ] **Google AI Studio Setup:** Generate the free Gemini API key for the `gemini-1.5-flash` model.
*   [ ] **Calendly Setup:** Generate the Calendly Personal Access Token.

## Phase 2: Core Services Development (Days 3-4)
*   [ ] **`SheetsService`:** Build the CRUD operations to interact with the "Patient Intake Records 2026" spreadsheet (find rows, insert new bookings, update status columns).
*   [ ] **`GmailService`:** Build the methods to fetch unread emails (`newer_than:1d`), extract the body/subject, and send outbound HTML emails (warnings, reminders, cancellations).
*   [ ] **`AiService`:** Build the wrapper for the Gemini API, hardcoding the strict medical prompt to prevent diagnosing and enforce the `[Not provided]` gap rules.
*   [ ] **`CalendlyService`:** Build the `cancelEvent(uuid)` method that fires the `DELETE` HTTP request to Calendly.

## Phase 3: Business Logic Integration (Days 5-6)
*   [ ] **Inbox Sweep Module:** Combine the services to read the inbox, parse booking/cancellation emails, run patient replies through the `AiService`, create the Google Doc, and update the database.
*   [ ] **Enforcement Module:** Write the scripts to query the sheet for 48-hour and 24-hour appointments. Implement the logic to send warnings or trigger the `CalendlyService.cancelEvent` method.
*   [ ] **The Cron Wrapper:** Wrap the entire execution flow inside a single `node-cron` job scheduled for `0 8 * * *` (8:00 AM daily).

## Phase 4: Testing & Deployment (Day 7)
*   [ ] **Staging Tests:** Run the script against a test Google Sheet and test Gmail account to ensure parsing and auto-cancellations execute correctly without infinite loops.
*   [ ] **Production Deployment:** Deploy the application to a cloud provider (e.g., AWS EC2, DigitalOcean VPS) using `PM2` to keep the Node.js process alive permanently.
*   [ ] **Logging:** Implement file-based logging (e.g., using `winston`) to trace daily execution successes and errors.
