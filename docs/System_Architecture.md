# System Architecture

## 1. High-Level Concept
The system is built as a **Node.js/TypeScript Backend Service**. It acts as a headless, event-driven cron worker. Instead of polling heavy external APIs constantly, it uses the clinic's Gmail inbox as a lightweight event queue, processing changes daily, executing strict 3-day enforcement rules, and maintaining a Google Sheet as its primary database.

## 2. Architecture Diagram

```mermaid
graph TD
    subgraph External Services
        CAL[Calendly Webhooks/Emails] --> INBOX[(Gmail Inbox)]
        PAT[Patient Replies] --> INBOX
    end

    subgraph Node.js Backend Application
        Trigger["⏰ node-cron\n(Daily at 8:00 AM)"] --> Sync["Service: InboxSweep"]
        
        subgraph Phase 1: Inbox Sweep Service
        Sync --> Fetch["Gmail API: Fetch last 24h"]
        Fetch --> Parse["Regex / String Parser"]
        
        Parse -- "Booking/Cancel" --> DB1["Google Sheets API:\nInsert/Update Row"]
        
        Parse -- "Patient Reply" --> AI["Google Gen AI SDK:\nGemini Flash Summarization"]
        AI --> DocsAPI["Google Docs API:\nCreate Document"]
        DocsAPI --> DB2["Google Sheets API:\nUpdate Status + Link"]
        end

        subgraph Phase 2: Enforcement Service
        Parse -.-> Find48["Google Sheets API:\nQuery Appts Date=Now+2"]
        Find48 --> Mail1["Nodemailer/Gmail:\nSend Warning Email"]
        
        Find48 --> Find24["Google Sheets API:\nQuery Appts Date=Now+1"]
        Find24 --> Branch{"Intake Status?"}
        
        Branch -- "Received ✅" --> Mail2["Send Reminder"]
        Branch -- "Pending ❌" --> CalAPI["Calendly REST API:\nDELETE /scheduled_events/{id}"]
        CalAPI --> DB3["Google Sheets API:\nMark Auto-Canceled"]
        DB3 --> Mail3["Send Cancellation Notice"]
        end
    end
```

## 3. Core Modules
- **`src/cron.ts`**: The main entry point initializing `node-cron` schedules.
- **`src/services/gmail.service.ts`**: Handles fetching unread emails and sending outbound templates.
- **`src/services/calendly.service.ts`**: Handles the HTTP DELETE requests to remove non-compliant bookings.
- **`src/services/sheets.service.ts`**: Acts as the ORM, abstracting the Google Sheets API to read/write appointment rows.
- **`src/services/ai.service.ts`**: Wraps the `@google/generative-ai` SDK to enforce the strict medical prompt.
