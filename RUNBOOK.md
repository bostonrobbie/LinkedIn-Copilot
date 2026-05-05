# Setup on your desktop

Walks you through extracting the tarball, installing dependencies, pushing to your repo, and running the app.

## 0. Prerequisites

- **Node.js 22+** — `node --version` to check.
- **git** with GitHub auth set up for `https://github.com/robertgorham-BDR/LinkedIn-Copilot-.git`.
- About **1 GB** free disk for `node_modules` + Playwright Chromium.

## 1. Extract

```bash
tar -xzf linkedin-copilot-day2.5.tar.gz
cd linkedin-copilot
```

## 2. Push to GitHub (one-time)

```bash
git init
git checkout -b claude/linkedin-sales-automation-DJK2c
git remote add origin https://github.com/robertgorham-BDR/LinkedIn-Copilot-.git
git add -A
git commit -m "MVP: LinkedIn Copilot — Electron + TS + React + Playwright + SQLite"
git push -u origin claude/linkedin-sales-automation-DJK2c
```

Then in GitHub click "Compare & pull request" to open the draft PR.

## 3. Install + sanity check

```bash
npm install            # ~40s, postinstall rebuilds better-sqlite3 for Electron
npm run typecheck      # silent on success
npm test               # runs 35 tests across gates / drafting / qa / inmail
npm run build          # produces out/main, out/preload, out/renderer
```

## 4. Launch

```bash
npm run dev
```

The app opens with the **first-run onboarding overlay**. It walks you through:

1. **Welcome** — short intro.
2. **LinkedIn login** — opens a separate Chromium window. Sign into LinkedIn AND Sales Navigator. Complete 2FA. The persistent profile remembers it across launches.
3. **Anthropic key** — paste it when ready, or skip and add later in Settings.
4. **Done** — close, click "New Outreach."

If you re-launch and want to revisit onboarding, clear `localStorage.removeItem('onboarding-complete-v1')` from DevTools (Cmd+Opt+I).

## 5. Header health banner

Top bar always visible across every view:

| Pill | Green | Yellow | Red |
| --- | --- | --- | --- |
| **LinkedIn** | logged in | not checked | logged out / error |
| **Anthropic** | configured | heuristic fallback | — |
| **Apollo** | configured | local dedup only | — |

State updates automatically after every successful capture or send.

## 6. Navigation

| Tab | Purpose |
| --- | --- |
| **Home** | Daily counters and the big "New Outreach" CTA. |
| **New Outreach** | The 6-step wizard: motion → mode → source → pipeline → review → sent. |
| **Activity** | Live-refreshing table of every draft and send. |
| **Analytics** | Accept rate, reply rate, by-motion breakdown, drop reasons, last-14-days trend. Also has the "Sync replies" button. |
| **Playbook** | Locked formulas, gate definitions, INC-022 / INC-026 protocols — the rules the agent runs on. |
| **Audit** | Full pipeline audit trail. Every gate decision logged with timestamp and reason. |
| **Settings** | LinkedIn login, API keys, TAM re-import, **demo seeds**. |

## 7. Run a real outreach

1. **New Outreach** → choose **Connection Request** OR **Sales Nav InMail**.
2. **Single prospect**.
3. Paste a LinkedIn profile URL or Sales Nav lead URL.
4. **Run pipeline** (or hit Enter). Watch the live event stream:
   - 0.5 DNC → 0.6 prior contact → 1.5 TAM scope → 0.7 degree → 0.7.5 deliverability → 3 Apollo dedup → research → drafting → 7.5 confidence
5. **Review** card shows:
   - Subject (InMail) + body
   - Char count, dept, hook
   - D1 / D2 / D3 score cells (overall ≥ 9.0 is the gate)
   - QA notes if anything failed
   - **Evidence card** below — live LinkedIn capture (headline, location, degree, follower / connection counts, activity status, evidence quote, recent activity)
6. **Actions** in the review card:
   - **Edit** — opens body + subject in textareas. Save → live D1 re-score (deterministic).
   - **Re-score (LLM)** — re-runs Opus on D2/D3 only.
   - **Copy** — copies subject + body to clipboard.
   - **Simulate send** — marks the row as sent without touching LinkedIn (insurance for rehearsal).
   - **Approve & Send** — runs the INC-022 readback protocol and clicks Send for real.

## 8. Demo-day insurance

In **Settings → Demo seeds**, click **Load demo prospects**. Inserts 3 pre-baked prospects (Rami @ SailPoint, Gabija @ Rocket Software, Barak @ Pathlock) with full evidence and 9.0–9.5/10 confidence drafts. Use them to:

- Rehearse the demo without burning real prospects.
- Fall back if LinkedIn rate-limits during the live demo.
- Test "Simulate send" to confirm the flow visually.

The seeded prospects appear in Activity. Click any of them, then walk through the review + simulate-send flow.

## 9. Reply sync

- **Background**: every 15 min while the app is open, the agent scans LinkedIn invitation manager + inbox for accepts and replies; writes them to outreach.
- **On-demand**: Analytics → "Sync replies".

The orchestrator and reply-sync also update the LinkedIn pill in the header — if a sync fails with auth-related errors, the pill flips to red and prompts you to re-login.

## 10. Audit trail

Every gate decision the agent makes lands in `gate_log`. The **Audit** view streams that table with phase / decision / reason / timestamp. Filterable. Use it to:

- Show judges that the agent is fully auditable.
- Diagnose why a prospect was dropped.
- Verify deterministic gates returned the right decision.

## 11. Tests

```bash
npm test            # one-shot
npm run test:watch  # watch mode while developing
```

35 tests across:

- `tests/gates.test.ts` — degree gate, deliverability INC-030
- `tests/drafting.test.ts` — dept routing, locked-formula constants
- `tests/qa.test.ts` — D1 deterministic scoring, fail reasons, D2 propagation
- `tests/inmail.test.ts` — InMail D1, lowercase "its" enforcement, sign-off check

Setup file (`tests/setup.ts`) mocks Electron / electron-log / better-sqlite3 so the agent code runs in plain Node.

## 12. Demo script (5 min, May 6 morning)

| Time | Action |
| --- | --- |
| 0:00–0:30 | Open app. Show header banner — LinkedIn ✓, Anthropic ✓. Walk through sidebar. |
| 0:30–1:00 | Settings → Demo seeds → Load (insurance). Show Activity has 3 demo rows. |
| 1:00–1:15 | New Outreach → Connection Request → Single → paste a real Sales Nav URL. |
| 1:15–3:30 | Live phase stream. Point out each gate. Evidence card populates with verbatim activity quote. Draft renders at 9.5/10. |
| 3:30–3:45 | (Optional) Click Edit, change one word, watch live D1 re-score. |
| 3:45–4:00 | Approve & Send. INC-022 readback. LinkedIn invitation appears in the agent's Chromium. |
| 4:00–4:30 | Activity feed: row appears. Audit tab: every gate decision logged. |
| 4:30–5:00 | Analytics: accept rate, reply rate, drop reasons. Close on "this is the front 80% of the BDR's day, automated." |

**Pre-demo checklist:**
- Onboarding cleared, LinkedIn logged in fresh, Anthropic key set.
- Demo seeds loaded.
- 2 backup prospect URLs queued in a notepad in case the live one rejects.
- Screen recording of a successful run as fallback if LinkedIn throws a captcha.

## 13. What's NOT in (post-demo backlog)

- Batch mode (TAM-driven prospecting → ranked candidate list)
- Real Apollo API integration (Phase 3 currently stubbed; works on local DB dedup)
- Conference / event-driven outreach
- Email channel (Apollo handles that)
- T2 follow-ups (out of scope per your spec)

## 14. Reporting bugs

Paste:

1. The view you were on
2. The full event stream from the wizard (or the audit row)
3. `~/Library/Application Support/LinkedIn Copilot/logs/main.log` (macOS) or `%APPDATA%\LinkedIn Copilot\logs\main.log` (Windows).

Or open a GitHub issue with the same info attached.
