# Alder & Sage — Master End-to-End System, Testing & Performance Audit Plan

**Document Version:** 2.1 (Production Performance & Rigorous Reliability Specification)  
**System Under Test:** Alder & Sage Medical Concierge & Multi-Portal Clinic Orchestration Platform  
**Target Environments:** Local Workstation (`localhost:8000`, `localhost:3000`, `localhost:5173`, `localhost:5174`) & Cloud Production (Render Backend + Vercel Multi-Service + Supabase PostgreSQL Pooler)  
**Author:** Lead Systems Architect & Performance Engineer  
**Sign-off Status:** Drafted for Approval Prior to Execution  

---

## 1. Executive Scope & Core Audit Objectives

This rigorous audit plan establishes the formal verification protocols for all production capabilities, strict security invariants, and performance benchmarks:
1. **Master Admin Universal Switcher:** Verification that `hospitalbookingsystem.0512@gmail.com` can seamlessly navigate across the **Admin Command Center**, **Doctor Oversight Desk**, and **Patient Concierge Portal** with zero permission rejections, backed by fluid pop-up animations.
2. **Smoothness & 60 FPS Transition Performance:** Hardware-accelerated transitions via Framer Motion, zero Cumulative Layout Shift (CLS < 0.05), and sub-100ms Interaction to Next Paint (INP).
3. **Live System Health Telemetry:** Verification that the Operations Suite displays real-time infrastructure states (PostgreSQL pooler :6543, Gmail Watch lease, AI providers, Sheets sync, and HTTP latency metrics) instead of mock placeholders.
4. **Database Audit Persistence:** Verification that changes made to staff members, physicians, or appointment compliance overrides are immutably persisted to PostgreSQL `audit_logs` and `staff_users` tables.
5. **Functional CSV Export Engine:** Verification that both the clinical appointment intake ledger (`/api/export/appointments.csv`) and the operational audit trail (`/api/export/audit.csv`) stream compliant CSV payloads with client-side fallback resilience.
6. **Optimized Multi-Service Compilation:** 100% clean production builds across all 4 frontend services (Next.js 16 Turbopack & Vite 7) with zero bundle bloat and zero TypeScript errors.

---

## 2. Comprehensive Audit Matrix

| Test ID | System Layer | Verification Target | Expected Behavior | Verification Metric |
| :--- | :--- | :--- | :--- | :--- |
| **PERF-01** | **UX / Performance** | 60 FPS Motion Transitions & GPU Acceleration | Modal open/close and cross-portal dissolution maintain consistent 60 FPS without frame drops. | Chrome Performance profiler (< 16.6ms per frame) |
| **PERF-02** | **UX / Optimization** | Interaction to Next Paint (INP) & Input Latency | Interactive elements (tabs, modal triggers, CSV export buttons) respond under 50ms upon user tap/click. | Web Vitals INP metric < 100ms |
| **PERF-03** | **Bundling & Build** | Tree-Shaking & Bundle Optimization | Next.js and Vite builds prune dead code; singlefile bundles compress cleanly without duplicate dependencies. | Exit code 0 across all 4 packages |
| **AUTH-01** | **Security / Auth** | Master Admin Universal Bypass | `is_master_account()` validates `hospitalbookingsystem.0512@gmail.com` across all route dependencies. | Unit test + JWT claim validation |
| **AUTH-02** | **Security / RBAC** | Doctor Role Strict Validation | Staff token with `role="doctor"` and `doctor_id=None` is rejected with HTTP 403; valid token accepted. | Strict foreign key claim enforcement |
| **AUTH-03** | **Security / Isolation** | Patient Boundary Isolation | Patient token cannot access `/api/admin/*` or `/api/doctor/*` (HTTP 403). | Zero cross-portal data leakage |
| **AUTH-04** | **Security / OAuth** | Google OAuth Callback Self-Provisioning | Simulating Google OAuth with new email creates `Patient` & `StaffUser` records without unhandled exceptions. | Zero 500 errors; auto-provisioning verified |
| **UI-01** | **Frontend Navigation** | Admin Console Panel Switcher Pop-Up | Clicking header emblem or "Admin Console" badge smoothly reveals `PanelSwitcherModal`. | Spring physics: `stiffness: 320, damping: 28` |
| **UI-02** | **Frontend Micro-Interactions** | Card Hover States & Micro-animations | Cards elevate smoothly with `scale: 1.02, x: 2`, border highlights, and pill color transitions. | CSS `transform-gpu` acceleration |
| **UI-03** | **Frontend Transitions** | Cross-Portal Cinematic Dissolve | Switching portals triggers a golden glowing ring overlay and smoothly navigates to target portal route. | Zero white screen flash; localStorage retained |
| **HLT-01** | **Telemetry API** | Live PostgreSQL Connection Probe | `GET /api/admin/system-health` returns `postgres_connected: true` via Supabase pooler (:6543). | Card displays `Connected · Supabase Pooler` |
| **HLT-02** | **Telemetry API** | Gmail Watch Lease & Telemetry | Live lease calculated dynamically against current UTC (e.g. `Active · renews in X days`). | Zero hardcoded static text |
| **HLT-03** | **Telemetry API** | AI Provider Router & Failover | OpenRouter and Nvidia NIM report configured and healthy. | Multi-model fallback state confirmed |
| **HLT-04** | **Telemetry API** | In-Memory HTTP Metrics | `total_requests` and `avg_latency_ms` update dynamically with live server traffic. | Real-time telemetry reflects true server workload |
| **DAT-01** | **Data Persistence** | Staff User DB Creation & Audit Event | Adding staff member sends `POST /api/admin/staff-users` and writes to `staff_users` & `audit_logs` in PostgreSQL. | Persistent across page reloads |
| **DAT-02** | **Data Persistence** | Staff User DB Deletion | Deleting staff member calls `DELETE /api/admin/staff-users/{id}` and updates DB instantly. | Deleted user cannot authenticate |
| **DAT-03** | **Clinical CRUD** | Doctor Profile DB Persistence | Adding doctor sends `POST /api/admin/doctors` and saves specialty, fee, and profile. | Physician profile active in scheduling |
| **DAT-04** | **Audit Engine** | Immutable Audit Log Ledger | Operations suite displays real entries from `audit_logs` table sorted chronologically. | Actor type, action, entity, metadata verified |
| **EXP-01** | **Data Export** | Streaming Audit Trail CSV | Clicking "Export audit CSV" streams `aurelis_audit_trail_YYYY-MM-DD.csv` with RFC 4180 headers. | File contains clean comma-separated values |
| **EXP-02** | **Data Export** | Streaming Appointment Ledger CSV | `GET /api/export/appointments.csv` streams full appointment and patient intake ledger. | Streaming response with correct headers |
| **EXP-03** | **Resilience** | Client-Side CSV Export Fallback | If the backend is offline, frontend automatically compiles table data into a downloadable CSV blob. | Zero broken buttons or silent failures |
| **INF-01** | **Cold-Start** | Proactive Backend Warm-Up | Root page mount and CTA button hovers dispatch `GET /health` to wake Render container. | Server is warm before user submits forms |

---

## 3. Performance & Smoothness Criteria (Web Designer Standard)

1. **Spring Physics Consistency:**
   - Popups: `stiffness: 320, damping: 28, mass: 1`
   - Hover scaling: `scale: 1.02` with 200ms ease curve
   - Active pill indicators: `scale: 1` with golden champagne border glow
2. **Backdrop Filter Optimization:**
   - All glassmorphic overlays use `backdrop-blur-xl` coupled with semi-transparent background colors (`bg-forest-950/70`) to minimize paint recalculation costs.
3. **Layout Shift Immunity:**
   - Container widths, modal shells, and avatar dimensions have explicit dimensional constraints to achieve a Cumulative Layout Shift (CLS) of 0.00.

---

## 4. Local Execution & Step-by-Step Testing Playbook

### Step 1: Run Backend Role Separation & Security Tests
```powershell
cd "c:\Users\user\projects\Hospital - booking system\backend"
pytest tests/test_role_separation.py -v
```

### Step 2: Launch Local FastAPI Backend
```powershell
cd "c:\Users\user\projects\Hospital - booking system\backend"
python run.py
# Server binds to http://127.0.0.1:8000
```

### Step 3: Launch Local Admin Command Center
```powershell
cd "c:\Users\user\projects\Hospital - booking system\frontend\admin"
npm run dev
# Server binds to http://localhost:3000
```

### Step 4: Verification Protocol (Manual & Visual)
1. Navigate to `http://localhost:3000`.
2. Click the top-left **AURELIS** emblem or the **Admin Console** badge.
3. Verify that the **Master Panel Switcher** pops up smoothly with spring physics and hover states.
4. Click on **Operations Suite -> System Health** tab. Verify all 6 cards display real telemetry.
5. In **Staff** tab, add a new test staff user and observe confirmation toast and persistent state.
6. Click **Export audit CSV** in the top right and verify that the CSV file downloads immediately.

---

## 5. Formal Sign-Off Checklist

- [ ] **Audit Plan Reviewed & Approved by User**
- [ ] **Local Verification Completed (Zero Defects)**
- [ ] **Git Push Authorized Post-Verification**
