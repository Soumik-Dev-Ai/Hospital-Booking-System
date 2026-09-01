### Bug #1
- Step: 1
- Symptom: The production home route returned HTTP 200 but emitted a console error for a failed Next.js RSC payload request: GET /home/__next.!KHNpdGUp.home.__PAGE__.txt?_rsc=... returned HTTP 404.
- Root cause: Next.js static export writes route RSC payloads inside nested __next.<build-hash>/<route>/__PAGE__.txt directories, while the browser requests the flattened __next.<build-hash>.<route>.__PAGE__.txt filename. The move-out helper did not create the compatibility aliases required by a unified static server.
- Fix applied: updated frontend/scripts/move-out.cjs to generate deterministic flattened RSC aliases for nested exported route payloads. File touched: frontend/scripts/move-out.cjs.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #2
- Step: 1
- Symptom: After the first fix and full rebuild, the home route still emitted HTTP 404 responses for /physicians/__next.!KHNpdGUp.physicians.txt, /services/__next.!KHNpdGUp.services.txt, and /home/__next.!KHNpdGUp.home.txt RSC requests.
- Root cause: The initial alias generator covered only __PAGE__.txt files and omitted the route-level <hash>.<route>.txt payloads requested during client navigation.
- Fix applied: broadened frontend/scripts/move-out.cjs to flatten every file beneath each __next.<hash> directory while preserving nested path segments. File touched: frontend/scripts/move-out.cjs.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #3
- Step: 1
- Symptom: Full browser validation of / returned HTTP 200 but produced a 404 console error and failed prefetch requests for /home, /physicians, and /services.
- Root cause: Next static export emits route documents as dist/<route>.html, but the unified static server receives extensionless navigation and prefetch requests at /<route>; no directory index aliases existed for those route names.
- Fix applied: updated frontend/scripts/move-out.cjs to create dist/<route>/index.html aliases for exported route documents during move-out. File touched: frontend/scripts/move-out.cjs.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #4
- Step: 1
- Symptom: After route and RSC checks passed, the home page still emitted a browser console 404; direct probing confirmed /favicon.ico returned HTTP 404.
- Root cause: The public Next.js export did not contain a favicon asset or an explicit icon link, so Chromium requested the conventional /favicon.ico path and the unified static server correctly returned 404.
- Fix applied: added frontend/Base Website/public/favicon.svg and explicit Next metadata icon entries in frontend/Base Website/src/app/layout.tsx.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #5
- Step: 1
- Symptom: In the clean restart, /patient/ returned HTTP 200 but emitted a browser console 404; no page error or hydration warning occurred.
- Root cause: the Vite patient entry document had no explicit favicon link, so Chromium probed /patient/favicon.ico and received HTTP 404.
- Fix applied: added an explicit /favicon.svg icon link to frontend/patient/index.html. File touched: frontend/patient/index.html.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #6
- Step: 1
- Symptom: In the clean restart, /doctor/ returned HTTP 200 but emitted a browser console 404; page errors and hydration warnings were absent.
- Root cause: the doctor Vite entry document had no explicit favicon link, so Chromium probed /doctor/favicon.ico and received HTTP 404.
- Fix applied: added an explicit /favicon.svg icon link to frontend/doctor/index.html. File touched: frontend/doctor/index.html.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #7
- Step: 1
- Symptom: In the clean restart, /admin/ returned HTTP 200 but emitted a browser console 404; page errors and hydration warnings were absent.
- Root cause: the admin Next layout had no explicit favicon metadata, so Chromium probed /admin/favicon.ico and received HTTP 404.
- Fix applied: added explicit shared favicon metadata to frontend/admin/src/app/layout.tsx. File touched: frontend/admin/src/app/layout.tsx.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #10
- Step: 2
- Symptom: With localStorage cleared before authentication, submitting the mock Patient login redirected to /home after 300 ms, left aurelis.session.v1 absent, and did not render Amelia Hartwell or the patient dashboard.
- Root cause: the mock API persisted demo-token-123, which is not a JWT; the patient app calls decodeJwt during session hydration, rejects the token, and clears the session during the first cross-app load.
- Fix applied: changed frontend/Base Website/src/lib/client-api.ts to return a valid non-expired mock JWT for demo sessions and sign-ups. File touched: frontend/Base Website/src/lib/client-api.ts.
- Loop restarted: yes (from Step 1 after the fix)


### Bug #11
- Step: 2
- Symptom: After a successful mock patient login and Return to Home Page navigation, the logged-in profile control could not be clicked; Playwright found the button but an initial landing-gate layer intercepted pointer events, so the required seamless profile-pill return to /patient/ failed.
- Root cause: the home page resets its Enter the Practice gate on every hard reload and keeps the authenticated header non-interactive until the gate is manually entered, even when a valid session is already present.
- Fix applied: changed frontend/Base Website/src/components/site/Navbar.tsx so the landing animation and pointer-events lock apply only to guests; authenticated sessions keep the profile pill interactive on /. File touched: frontend/Base Website/src/components/site/Navbar.tsx.
- Loop restarted: yes (from Step 1 after the fix)



### Bug #12
- Step: 3
- Symptom: Real doctor doc-01 with offset 7 produced valid deterministic slots in source, but the live UI rendered zero slot controls after selecting the date.
- Root cause: calendar selection did not explicitly preserve the expanded option state.
- Fix applied: added setOpenId(calendarFor) in the Calendar3DPopup onSelect handler. File touched: frontend/patient/src/components/BookingFlow.tsx.
- Loop restarted: yes (from Step 1 after the fix)

### Bug #13
- Step: 4
- Symptom: Source audit found 2 pure #fff/#000 color occurrences, 10 emoji/sparkle/magic-wand matches, 133 em-dash matches, and 319 radius-token matches against the approved-scale check.
- Root cause: legacy copy, icon text, and broad visual-token usage remain in the frontend source despite the professional forest/champagne design requirement.
- Fix applied: pending; remove prohibited literals and replace AI-tell punctuation/iconography while preserving approved semantic theme tokens.
- Loop restarted: yes (from Step 1 after the fix)

