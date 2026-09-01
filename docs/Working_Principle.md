# Working Principle

## Execution Flow (Node.js Application)

The application is structured as a series of asynchronous TypeScript functions executed sequentially by a daily cron job.

### Phase 1: `InboxSweepService`
Instead of constantly polling the Calendly API for 365 days of data, the system treats the clinic's Gmail inbox as an event queue.
1. The app calls the Gmail API, searching for `newer_than:1d`.
2. For each email, a parsing utility analyzes the subject and body:
   - **Booking / Cancellation Emails:** Extracts the patient details and Appt_ID using Regex. The `SheetsService` inserts or updates the corresponding row in the monthly tab.
   - **Patient Replies:** Detects the hidden `Ref: #[Appt_ID]` string. The `AiService` sends the email body to the Gemini API with the strict administrative prompt. The `DocsService` creates the summary doc, and the `SheetsService` updates the status to `Received`.

### Phase 2: `EnforcementService`
With the Google Sheet database up to date, the app executes the business logic:
1. **The 48-Hour Warning:** 
   - Queries the Google Sheet for appointments happening `Date == Today + 2`.
   - Maps over the results. If `Intake_Status === 'Pending'`, the `GmailService` sends a strict warning email.
2. **The 24-Hour Auto-Cancel:**
   - Queries the Google Sheet for appointments happening `Date == Today + 1`.
   - If `Intake_Status === 'Received'`, sends a friendly reminder email.
   - If `Intake_Status === 'Pending'` (non-compliant), the app triggers the `CalendlyService.cancelEvent(appt_id)` method, updating the sheet and emailing the patient a cancellation notice.

### Phase 3: `DoctorBriefingService`
Once processing is complete, the `GmailService` sends a simple, hardcoded email to the doctor containing the URL to the Google Sheet, assuring them that the schedule is curated and all non-compliant patients have been removed.

### Security & Reliability
- **Statelessness:** If the server restarts, no data is lost because the true state lives in the Google Sheet and the unread/read state of the Gmail inbox.
- **Idempotency:** The functions check the `Intake_Status` before acting, preventing a patient from receiving duplicate warnings if a script runs twice.
