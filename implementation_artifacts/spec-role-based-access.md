---
title: 'Role-based login, dashboards, and reports'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: '534290ce470891f494931e1f2dd2a163db57e49b'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The active login path can issue a fake token that backend routes reject, and the app does not route authenticated admins and users to separate dashboards. Report creation also imports a server helper that the report module does not export.

**Approach:** Use signed backend JWTs with roles, allow first-time user sign-in to create a password-hashed account for any unused email/password pair, and keep configured admin credentials environment-only. Route admins to a protected aggregate dashboard and users to their private query workbench/history. Generate saved and exported reports with QueryPilot branding and the authenticated user's identity.

## Boundaries & Constraints

**Always:** The backend is authoritative for role and identity; admin access requires the configured environment credentials and admin middleware; user reports remain scoped to the signed-in user; preserve existing uncommitted edits.

**Ask First:** Do not weaken or bypass JWT validation, admin credential checks, or report ownership boundaries.

**Never:** Trust a role, email, or report owner supplied only by the browser; issue demo/fake tokens; expose passwords in admin responses.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin login | Matching configured email/password | Admin JWT and admin dashboard; aggregate endpoints load | Wrong password is rejected; never falls through to user login |
| First user login | Unused email and non-empty password | Hashed account is created and user dashboard opens | Configured admin email cannot self-register |
| Existing user login | Existing email and matching password | User JWT and only that user's reports/stats | Wrong password is rejected |
| Report generation | Signed-in user analyzes SQL | Persisted report contains QueryPilot app name and authenticated user identity | Unauthenticated/admin analyze request is rejected |

</frozen-after-approval>

## Code Map

- `client/src/App.jsx` -- role-aware session routing, separate dashboards, report display/export.
- `client/src/Auth.jsx` -- existing uncommitted legacy auth UI; preserve unless it remains on the active path.
- `server/server.js` -- login, JWT guards, user/admin APIs, authenticated report owner.
- `server/models/Report.js` -- report helper currently mismatches the server import.

## Tasks & Acceptance

**Execution:**
- [x] `client/src/App.jsx` -- persist role-bearing auth response, validate restored session, render separate user/admin dashboards and include identity/app branding in exports.
- [x] `server/server.js` -- provision first-time user credentials securely while preserving env-configured admin login and role authorization.
- [x] `server/models/Report.js` -- provide the server report-document helper and include app/user metadata.

**Acceptance Criteria:**
- Given valid environment-configured admin credentials, when the admin signs in, then the admin dashboard loads aggregate stats, users, and reports and user-only analysis is unavailable.
- Given a previously unused email and password, when a user signs in, then a hashed account and user JWT are created; subsequent sign-ins require the matching password.
- Given a user JWT, when reports or stats are requested, then results are scoped to the JWT email regardless of query parameters.
- Given a user runs an analysis, when the report is persisted/exported, then it identifies QueryPilot and the authenticated user.

## Verification

**Commands:**
- `npm run build --prefix client` -- expected: Vite production build succeeds.
- `node --check server/server.js` -- expected: server syntax check succeeds.
- `node --check server/models/Report.js` -- expected: report module syntax check succeeds.

## Suggested Review Order

**Authentication and role enforcement**

- Server-issued roles and credentials determine the permitted identity.
	[`server.js:280`](../server/server.js#L280)

- Persisted sessions are revalidated before any dashboard is rendered.
	[`App.jsx:232`](../client/src/App.jsx#L232)

- Admins branch to their aggregate-only view, separate from user query tools.
	[`App.jsx:459`](../client/src/App.jsx#L459)

**Report identity**

- JWT identity owns each generated report; request-supplied identity is ignored.
	[`server.js:621`](../server/server.js#L621)

- Stored reports carry QueryPilot and authenticated user metadata.
	[`Report.js:1`](../server/models/Report.js#L1)

- PDF exports display the signed-in user's identity with QueryPilot branding.
	[`App.jsx:304`](../client/src/App.jsx#L304)

**Configuration**

- Admin credentials and the JWT signing secret are deployment environment settings.
	[`.env.example:4`](../server/.env.example#L4)
