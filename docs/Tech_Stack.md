# Tech Stack

This project is a custom-coded backend application, entirely moving away from no-code platforms.

## 1. Core Runtime & Language
- **Node.js (v20+)**: The robust backend JavaScript runtime.
- **TypeScript**: Used for strict typing, particularly when dealing with complex API responses from Calendly and Google.

## 2. Process Orchestration
- **`node-cron`**: A lightweight task scheduler used to trigger the Inbox Sweep and Enforcement services at exactly 8:00 AM every day.
- **PM2 / Docker**: Used for running the Node.js process continuously in production on a VPS or cloud environment.

## 3. Database
- **Google Sheets API**: The database layer. Google Sheets is used because it provides the doctor with a familiar, spreadsheet-based frontend interface while the Node.js backend treats it purely as a database via the `googleapis` npm package.

## 4. Third-Party Integrations
- **Google APIs Client Library (`googleapis`)**: 
  - *Gmail API*: Used to fetch incoming event notifications and send outbound HTML emails.
  - *Docs API*: Used to dynamically generate the 1-page patient summary documents.
- **Calendly REST API (v2)**: Handled via `axios` or native `fetch` to execute hard cancellations (`DELETE /scheduled_events/{uuid}/cancellation`).

## 5. AI Engine
- **Google Generative AI SDK (`@google/generative-ai`)**:
  - Model: `gemini-1.5-flash`
  - Chosen because of the generous free tier (Google AI Studio) and lightning-fast inference times. The SDK makes it trivial to pass the strict administrative prompt alongside the patient's raw email text.
