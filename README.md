# RiskyUser101

A guided M365 risky-user investigation workbench for engineers. Follow the evidence, capture findings, distinguish user compromise from control gaps, and copy a structured plain-text handoff into your ticket.

## Run locally

Requires Node.js 22 or later; no installation or build is needed.

```sh
npm test
npm run serve
```

Open **http://127.0.0.1:4173/RiskyUser101/**. The preview mirrors the GitHub Pages repository path. Use an HTTP server instead of opening `index.html` as a file: browser module and storage restrictions differ for file URLs.

## GitHub Pages deployment

The static website lives in `docs/`. After merging the application PR into `main`:

1. Open repository **Settings → Pages**.
2. Select **Deploy from a branch**.
3. Select **main** and **/docs**, then **Save**.
4. Wait for deployment. The expected address is **https://thexyloman.github.io/RiskyUser101/**; use the exact address reported by GitHub if configuration changes it.
5. Verify styles and scripts load, create a fictional case, refresh, copy/select a partial ticket summary, and use **End session** to clear the case.

CI runs decision, summary, storage, and static-file checks on PRs and pushes to main. Branch-based Pages needs no separate application build workflow. No secrets or Microsoft Graph permissions are required.

## Investigation coverage

- Tenant/user lookup, privileged access, licensing, period and timezone.
- Multiple interactive/non-interactive sign-ins, surrounding activity, detections, and request/correlation IDs.
- Password acceptance, MFA/strong authentication, reused claims, overall access, and confirmed password-only access.
- App/resource identities, protocol, IP/ASN/location, VPN/travel, device trust, management, compliance, and individual policy results.
- Independent verification, method changes, unexpected approvals, phishing, and token/session correlation.
- Forwarding and hidden rules, delegates, messages, consent/permissions, account/role changes, files, alerts, persistence and impact.
- Recommended/pending/escalated/completed actions, engineer overrides, senior ownership, and ticket notes.

The guide reads no tenant data and performs no resets, revocations, tenant changes, or notifications. Follow the organisation’s authorised incident process for operational actions.

## Session-only evidence

Answers, progress, actions, and the ticket draft use **tab-scoped sessionStorage** under one application key. They survive refresh, with no history or backend. No localStorage, database, analytics, external font/script, evidence-bearing URL, or network request carries answers.

Ordinary independent tabs have separate sessions. Browsers can restore or duplicate a tab session. **End session** explicitly clears the application key and in-memory case; use it when finished. If storage is unavailable, the guide falls back to memory and indicates that refresh clears the case. Unrelated storage is preserved.

Copying the summary deliberately transfers text to the engineer’s clipboard. The tool does not save tickets or transmit their text. Never enter passwords, tokens, recovery codes, or secrets. Hosting serves generic guide files; it does not grant M365 access or provide a team case database.

## Assessment rules

The guide assessment is separate from Microsoft’s reported risk. It uses the highest triggered severity, without probabilities or a points total:

| Severity | Evidence |
| --- | --- |
| Critical | Confirmed malicious privileged access, active attacker persistence, or exfiltration |
| High | Accepted credentials for verified unauthorized activity, unauthorized successful access/MFA approval or method changes, credential-compromise detection, or corroborated token compromise |
| Medium | Unresolved detections, suspicious context/activity, or identity concerns |
| Low | Fully reviewed unsuccessful-only attempts without accepted credentials or unauthorized access |
| No compromise identified | Complete evidence supports legitimate activity without contradictory findings |
| Unassessed | Insufficient reviewed evidence |

Unknowns, unavailable evidence, pending verification, unchecked stages, and stale answers keep assessments provisional. Reasoned not-applicable findings are recorded. Confirmed password-only cloud access always creates senior control escalation, even with an exception; it does not alone prove compromise. The “single factor” label alone is insufficient.

Earlier finding changes invalidate dependent checks. Retained answers remain visible with a warning and are excluded until rechecked. One event’s changes do not invalidate another event’s authentication. Completed-action records remain even if recommendations change. Overrides retain calculated severity/control escalation and require reconfirmation after evidence changes.

Ticket notes flag partial investigations and separate completed actions with evidence/timestamps from recommendations. Custom summary edits last for the session; changing findings regenerates the draft. No-compromise closure is rejected while checks or contradictory findings remain unresolved.

## Source and maintenance

- `docs/assets/content.js`: questions, navigation, explanations, conditional prompts, and sources.
- `model.js`: risk rules, validation, dependencies, and completion.
- `session.js`: session persistence and restoration validation.
- `summary.js`: ticket template and action-status reporting.
- `app.js` and `styles.css`: browser interface.
- `tests/`: investigation, dependency, session, summary, and static privacy checks.

Guidance reviewed **10 October 2026** against Microsoft Learn. Portal labels/reports vary by licensing, roles, retention, and updates. Recheck sources before changing rules:

- [Investigate identity risk](https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-investigate-risk)
- [Authentication details](https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-reporting)
- [Sign-in fields](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-in-log-activity-details)
- [M365 compromise response](https://learn.microsoft.com/en-us/defender-office-365/responding-to-a-compromised-email-account)
- [Remediate risks](https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-remediate-unblock)
- [Revocation limits](https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access)
- [Session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

## Browser acceptance

Inspect desktop/mobile layouts and keyboard navigation. Expand guidance, validate fields, add/remove events, change upstream evidence, recheck stale answers, record actions, test copy/select-all, refresh, and end session. Verify browser network activity never includes case text. Use fictional evidence in tests/screenshots.
