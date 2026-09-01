# Product Requirements Document (PRD): Patient Intake Backend

## 1. Project Overview
The Patient Intake and Visit-Prep Pack is a custom-coded backend application built with Node.js and TypeScript. It strictly automates scheduling enforcement, patient intake data collection, AI-powered clinical summarization, and daily doctor briefings via a completely autonomous cron-driven architecture.

## 2. Target Audience
*   **Medical Professionals / Doctors:** Need a 100% curated schedule where every patient walking in has a 1-page clinical summary ready.
*   **Administrative Staff:** Eliminated from the loop. The Node.js application handles all chasing and cancellations autonomously.
*   **Patients:** Must comply with strict clinic intake policies or face automated appointment cancellation.

## 3. Core Objectives
*   **Inbox-Driven State Machine:** The backend monitors the clinic Gmail inbox via IMAP/API to detect bookings, cancellations, and patient replies in near real-time.
*   **2-Day Warning:** Enforce a strict warning 48 hours before the appointment.
*   **1-Day Auto-Cancel:** If intake is not received 24 hours prior, the system autonomously hits the Calendly REST API to delete the event, freeing up the doctor's calendar.
*   **AI Summarization:** Utilize the Google Gemini API to parse unstructured patient emails into highly standardized 1-page Google Docs.

## 4. Architectural Constraints
*   **Standalone Application:** The system must be built as a self-contained Node.js process (or serverless function) utilizing standard libraries (`node-cron`, Google APIs).
*   **Compute Efficiency:** No wasteful polling of 365 days of data. The application processes incremental changes based on inbox activity and strictly queries dates hitting the 24/48-hour deadlines.

## 5. Strict AI Behavior Guidelines
*   **Strictly Administrative:** Use the patient's own words where wording matters.
*   **No Medical Practice:** The LLM never diagnoses, interprets symptoms, or advises.
*   **Handling Gaps:** Explicitly mark missing info as `[Not provided]`.
*   **Internal Use Only:** AI outputs are solely for the doctor's Google Sheet dashboard. Patient emails are hardcoded HTML templates.
