# LinkedIn Copilot

Desktop app for Testsigma BDRs/AEs that handles the front-end of LinkedIn outreach end-to-end: prospecting from TAM, research, drafting against locked formulas, QA scoring, and Playwright-driven send. Each prospect goes from URL to a sent invitation in under 5 minutes, gated at a 9.0/10 confidence floor.

## Status

MVP — single-user (Rob), connection-request hero flow + Sales Nav InMail second flow. Built on top of the BDR repo's `linkedin-connection-batch` v2 skill (locked Apr 30, 2026). Multi-user-ready data model.

See `CHANGELOG.md` for what shipped each day, `HANDOFF.md` for next-agent onboarding, `SKILL_GAPS.md` for ported-vs-pending against the BDR canonical skill.

## Stack

- Electron 33 + Vite + TypeScript
- React 18 + Tailwind (dark theme)
- Playwright (Node) with persistent Chromium profile, separate from your daily Chrome
- better-sqlite3 for local-first storage with versioned migrations
- Anthropic SDK (`@anthropic-ai/sdk`) — Sonnet 4.6 for hooks, Opus 4.7 for QA scoring; graceful heuristic fallback when no key
- zod for runtime LLM-response validation
- Vitest + GitHub Actions CI

## Running

```bash
npm install
npm run dev
```

First launch opens the onboarding overlay: sign into LinkedIn + Sales Nav once in the embedded browser, drop in your Anthropic / Apollo keys (optional), import your TAM CSV.

```bash
npm run typecheck    # silent on success
npm run test         # 50 Vitest tests
npm run smoke        # 22-check CLI validation
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # production build
npm run package      # electron-builder --dir (unpacked app)
npm run dist         # electron-builder (full installer)
```

## Architecture

```mermaid
flowchart LR
  subgraph Renderer["Renderer (React)"]
    UI[Pages: Home, New Outreach,<br/>Activity, Accounts, Analytics,<br/>Playbook, Audit, Health, Settings]
    UI --> ContextBridge["window.api<br/>(contextBridge)"]
  end

  subgraph Preload["Preload"]
    ContextBridge --> IPC["IPC handlers"]
  end

  subgraph Main["Main process"]
    IPC --> Agent["Agent core"]
    IPC --> DB["SQLite (better-sqlite3)"]
    IPC --> Health["Health / Preflight"]
    IPC --> Browser["Playwright session"]

    Agent --> Gates["Gates 0.5/0.6/0.7/0.7.5/1.5/3"]
    Agent --> Research["Research"]
    Agent --> Drafting["Drafting + locked formulas"]
    Agent --> QA["QA / D1 D2 D3 scoring"]
    Agent --> Sending["Sending (INC-022 readback)"]
    Agent --> Sync["Reply sync worker"]
    Agent --> Queue["Send queue (retry worker)"]

    Research --> Browser
    Sending --> Browser
    Sync --> Browser

    Drafting --> LLM["llm.ts<br/>(zod-validated, retry+backoff)"]
    QA --> LLM

    LLM --> Anthropic[("Anthropic API<br/>Sonnet + Opus")]
    Browser --> LinkedIn[("LinkedIn / Sales Nav<br/>via persistent Chromium")]
    Gates --> DB
    Sending --> DB
    Sync --> DB
    Queue --> DB
    Health --> DB
  end
```

### Data flow for a single prospect

```mermaid
sequenceDiagram
  participant U as User (renderer)
  participant O as Orchestrator
  participant B as Playwright
  participant L as LLM (Anthropic)
  participant D as SQLite

  U->>O: runSingle(motion, url)
  O->>B: capturePublicProfile(url) [watchdog 90s]
  B-->>O: ProfileCapture
  alt LinkedIn session expired
    O->>U: emit auth_required
    U->>B: loginLinkedIn() (persistent profile)
    B-->>U: ok
    O->>B: retry capture
  end
  O->>D: insert prospect, evidence, gate_log per phase
  O->>O: gates 0.5 / 0.6 / 1.5 / 0.7 / 0.7.5 / 3 / auto-drop
  alt any gate drops
    O-->>U: drop_reason + status
  else all gates pass
    O->>L: generateHook (zod-validated, retries on 429)
    L-->>O: hook + tenure_bucket
    O->>L: scoreD2D3 (Opus)
    L-->>O: D2/D3 score
    O->>D: insert outreach (status=draft, confidence=N)
    O-->>U: draft + confidence
    U->>O: approveAndSend(outreach_id)
    O->>B: sendConnectionRequest [watchdog 60s, INC-022 readback]
    alt watchdog timeout
      O->>D: enqueue send_queue with backoff
      O-->>U: queued for retry
    else send ok
      B-->>O: sent
      O->>D: outreach.status=sent, sent_at=now
      O-->>U: sent ✓
    end
  end
```

## Database schema

```mermaid
erDiagram
  users ||--o{ accounts : owns
  users ||--o{ prospects : owns
  users ||--o{ outreach : owns
  users ||--o{ dnc : owns
  users ||--o{ prior_contacts : owns
  users ||--o{ analytics_daily : has
  users ||--o{ send_queue : owns
  accounts ||--o{ prospects : "has many"
  prospects ||--o{ evidence : "has many captures"
  prospects ||--o{ outreach : "has attempts"
  outreach ||--o| evidence : "anchored to"
  outreach ||--o{ gate_log : audited
  outreach ||--o{ send_queue : "queued retries"

  users {
    int id PK
    text email
    text display_name
    blob anthropic_api_key_enc "safeStorage encrypted"
    blob apollo_api_key_enc
  }
  accounts {
    int id PK
    int user_id FK
    text name
    text domain
    text tier "TAM | Factor | G2 | Other"
  }
  prospects {
    int id PK
    int user_id FK
    int account_id FK
    text full_name
    text linkedin_url
    text linkedin_slug
    text title
    text company_name
  }
  evidence {
    int id PK
    int prospect_id FK
    text live_headline
    text connection_degree
    int follower_count
    int connection_count
    text activity_status
    text evidence_quote_for_hook
    text captured_at
  }
  outreach {
    int id PK
    int user_id FK
    int prospect_id FK
    int evidence_id FK
    text motion "connection_request | sales_nav_inmail"
    text draft_body
    text draft_subject
    text hook
    text dept
    real confidence
    text status "draft|sent|accepted|replied|declined|failed|dropped"
  }
  gate_log {
    int id PK
    int outreach_id FK
    text phase
    text decision
    text reason
    text ts
  }
  send_queue {
    int id PK
    int outreach_id FK
    int attempts
    text next_attempt_at
    text status
  }
  dnc {
    int id PK
    int user_id FK
    text name_norm
    text reason
  }
  prior_contacts {
    int id PK
    int user_id FK
    text name_norm
    text channel
  }
```

## Project layout

```
src/
  main/                       Electron main process
    db/
      schema.sql              Snapshot of current schema (canonical: migrations/)
      migrations/             Versioned migrations (PRAGMA user_version)
      client.ts               Connection management
      seed.ts                 First-run seeding from data/seed/
      backup.ts               Online backup + restore
      migrate.ts              Migration runner
    browser/
      session.ts              Persistent Playwright Chromium profile
      linkedin.ts             LinkedIn selectors + INC-022 readback send
      watchdog.ts             Timeout wrapper for Playwright calls
    agent/
      orchestrator.ts         Pipeline: research → gates → drafting → QA
      gates.ts                Phase 0.5/0.6/0.7/0.7.5/1.5/3 + auto-drop
      research.ts             Profile capture + auto-drop signal detection
      drafting.ts             Connection-request locked formula + LLM hook
      inmail.ts               Sales Nav InMail 5-paragraph hero formula
      qa.ts                   D1 deterministic + D2/D3 LLM scoring
      llm.ts                  Anthropic SDK with zod validation + 429 backoff
      sending.ts              approveAndSend with watchdog + auto-enqueue
      sendQueue.ts            Persistent retry queue with backoff worker
      sync.ts                 Reply-sync background worker
      analytics.ts            Rollup queries + Today's Actions
      demo-seeds.ts           3 pre-baked prospects for rehearsal
    health/
      preflight.ts            12 startup self-tests
      logTail.ts              Reads electron-log main.log
      playwrightInstall.ts    npx playwright install chromium runner
    ipc/handlers.ts           All IPC routes
    secrets.ts                safeStorage encrypt/decrypt for API keys
    runtime-state.ts          In-memory LinkedIn session state
    index.ts                  Electron entry
  preload/index.ts            contextBridge — typed window.api
  renderer/
    App.tsx                   Sidebar shell + view router + global shortcuts
    components/
      HeaderBanner            LinkedIn / Anthropic / Apollo / Sends-today pills
      Toast                   Notification system
      Onboarding              First-run overlay
      Shortcuts               Cmd+/ overlay
      CommandPalette          Cmd+K fuzzy search
      PipelineProgress        Vertical stepper visualization
      ErrorBoundary           Per-page render-error recovery
    pages/
      Home                    Today's Actions stack
      NewOutreach             6-step wizard (single + bulk modes)
      Activity                Searchable filterable table
      OutreachDetail          Per-prospect drill-down
      Accounts                ABM-style per-account view
      Analytics               Accept/reply rate, drop reasons, trends
      Playbook                BDR skills + locked formulas viewer
      Audit                   Gate-decision log viewer
      Health                  Preflight + log tail
      Settings                Keys, LinkedIn login, TAM, demo seeds, backups
  shared/types.ts             Cross-process IPC contract
data/
  seed/                       Bundled seed (TAM, DNC, MASTER_SENT_LIST, skills, playbooks, templates)
  userdata/                   Per-user runtime (gitignored)
tests/                        Vitest suites
scripts/                      smoke.mjs, extract-dnc.mjs
.github/workflows/ci.yml      typecheck + test + build on push
.husky/pre-commit             lint-staged
```

## BDR repo lineage

This app ports — does NOT replace — the following BDR assets. The BDR repo is the canonical source of truth; this app re-syncs on demand via `Settings → Re-import TAM` or by re-running `scripts/extract-dnc.mjs`.

- `tam-accounts-mar26.csv` → `data/seed/tam.csv`
- `MASTER_SENT_LIST.csv` → `data/seed/master_sent_list.csv`
- `skills/linkedin-connection-batch/SKILL.md` v2 → `data/seed/skills/linkedin-connection-batch.md`
- `skills/linkedin-connect/SKILL.md` v1.2 → `data/seed/skills/linkedin-connect.md`
- `memory/playbooks/linkedin-batch-quality-gate.md` → `data/seed/playbooks/`
- `memory/playbooks/linkedin-send-preflight.md` → `data/seed/playbooks/`
- DNC list from `CLAUDE.md` → `data/seed/dnc.json` (extracted by `scripts/extract-dnc.mjs`)
- Locked connection-request formula (INC-022) — encoded in `src/main/agent/drafting.ts`
- Locked InMail 5-paragraph formula — encoded in `src/main/agent/inmail.ts`

The BDR repo is read-only for this project.

## Reliability

- **Preflight** runs 12 checks at startup + every 15s on the Health page (Cmd+8): schema version, DB writable, integrity_check, seed counts, Playwright Chromium binary, LinkedIn session, API keys, encryption availability, INC-028 throttle, drop rate.
- **Watchdog** wraps every Playwright call with a hard timeout (90s capture, 60s connect-send, 90s InMail-send).
- **Send queue** persists watchdog-timed-out sends and retries with exponential backoff (1m, 5m, 15m, 60m, 240m).
- **LinkedIn session-expiry** auto-detected mid-pipeline; renderer auto-prompts re-login; orchestrator resumes the in-flight run.
- **Anthropic 429 / 5xx** retried with exponential backoff (1s, 2s, 4s, 8s); status surfaced into the wizard event log.
- **LLM responses** zod-validated; on parse failure, one retry with a stricter system prompt, then heuristic fallback.
- **Schema migrations** versioned via `PRAGMA user_version`; existing installs upgrade cleanly on app update.
- **Backups** created on demand from Settings; auto-pruned to last 20; restore via UI.
- **API keys** encrypted at rest via Electron `safeStorage` (OS keychain backed) when available.
- **Error boundaries** per page so a render bug in one view doesn't blank the whole app.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Cmd+K` | Command palette (fuzzy search prospects, accounts, actions) |
| `Cmd+1`–`Cmd+9` | Switch tabs |
| `Cmd+N` | New outreach |
| `Cmd+/` | Shortcuts overlay |
| `Esc` | Close detail / overlays |
