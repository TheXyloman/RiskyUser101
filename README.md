# RiskyUser101

A guided **Entra ID risk check for first- and second-line engineers**. Follow the core checks, record findings, review explained recommendations, and copy plain-text ticket notes.

**Live guide:** https://thexyloman.github.io/RiskyUser101/

## Engineer workflow

1. Find the user: email, optional client, optional ticket reference. Confirm the tenant in Entra.
2. Check the sign-in: time, app, IP, location, result, Microsoft risk, and surrounding attempts.
3. Check password and MFA results: separate failed passwords, accepted passwords with failed MFA, successful MFA, passwordless authentication, existing claims, and confirmed password-only access.
4. Check the device and Conditional Access using the Entra sign-in tabs: join type, managed/compliant status, expected device, and policy enforcement or exclusions.
5. Verify the user and review MFA methods, audit changes, admin roles, user risk, and suspicious session indicators.
6. Record actions and escalation. Recommendations remain recommendations until the engineer records completion evidence.
7. Copy editable ticket notes, including any outstanding evidence and follow-up.

All portal checks stay within Entra ID. There are no request/correlation identifiers, app/resource/device IDs, mailbox checks, or other workload investigations. Wider incident work belongs to the senior team. Routine written notes are optional; unknown/unavailable answers require reasons and remain investigation gaps. Detailed explanations are expandable.

## Run and test

No dependencies or build step. Use Node.js 22 or newer:

```sh
npm test
npm run serve
```

Open `http://127.0.0.1:4173/RiskyUser101/`. The local server mirrors the GitHub Pages repository path. CI runs the tests and checks JavaScript syntax on pull requests and main.

Files under `docs/` use relative paths. Workflow content, assessment rules, session storage, summary generation, and UI are separate modules. Tests cover authentication branches, case aggregation, stale answers, gaps, actions/overrides, session recovery/migration, clearing, storage failure, safe rendering, and Entra-only scope.

## GitHub Pages

Repository Settings → Pages → Deploy from a branch → **main /docs** → Save. Merged changes publish automatically. After deployment, check the Pages build result, load the live guide, and verify the changed assets and basic flow.

## Session privacy

Only the current case is stored in tab-scoped `sessionStorage`. There is no backend, localStorage, analytics, external script, or case data in URLs/network requests. A restrictive CSP blocks application network connections. User input renders as text. Generic portal links use `noopener noreferrer` and do not include case details.

Refresh recovers the case. Ordinary independently opened tabs have separate cases; browser tab duplication/restoration can copy or restore session storage. **End session** explicitly removes the application’s current and previous-version keys, leaving unrelated storage alone. If storage is unavailable, the app continues in memory and warns that refresh clears the case. Never enter passwords, recovery codes, or token values.

Existing version-1 tab sessions retain compatible core answers and action records when updated. Removed fields are discarded, older out-of-scope action notes are carried into follow-up, and all checks reopen for review. Ticket drafts are regenerated for the new scope.

## Assessments and escalation

Guide severity, completeness, Microsoft risk, and tenant/control findings remain separate. The highest applicable severity wins; no compromise percentages are calculated. Accepted credentials in unauthorized activity, unauthorized successful access/MFA approval or MFA changes, and corroborated token compromise are High. Confirmed unauthorized access for an Entra admin is Critical. Unresolved concerns are Medium. Completed unsuccessful-only checks can be Low; complete, supported legitimate activity can produce “No compromise identified”. Gaps prevent a conclusive safe outcome.

Every confirmed password-only cloud access gap requires senior review, including approved exceptions. A “single factor” label alone does not prove missing MFA. Policy results, enrolled devices, and MFA success do not prove legitimacy. Changes to earlier answers reopen dependent checks and exclude stale findings until reviewed. Engineer overrides preserve the guide calculation and escalation requirements.

The guide performs no Entra changes or notifications. Password resets, session revocation, sign-in blocking, and MFA changes follow the engineer’s authorised runbook. Hybrid password authority and the limits of immediate session revocation are explained in the action guidance.

## Sources

Guidance reviewed 10 October 2026:

- [Investigate identity risk](https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-investigate-risk)
- [Authentication details and MFA](https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-reporting)
- [Sign-in fields](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-in-log-activity-details)
- [Remediate risks](https://learn.microsoft.com/en-us/entra/id-protection/howto-identity-protection-remediate-unblock)
- [Revocation limits](https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access)
- [Session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

## Browser acceptance

Check keyboard navigation and desktop/mobile layouts. Complete a routine case without mandatory prose, exercise risk branches and uncertainty reasons, add/remove sign-ins, change upstream answers, recheck stale answers, record actions, copy/select/regenerate notes, refresh, and end the session. Use fictional evidence in tests and screenshots. The Entra-only notes must not claim a wider compromise investigation was performed.
