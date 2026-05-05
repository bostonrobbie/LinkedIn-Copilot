# Troubleshooting

When something breaks, walk this in order. Most problems land on the first or second step.

## 1. Check the Health page first

`Cmd+9` (or click "Health" in the sidebar). The preflight runs 12 checks. Anything red has a `Fix:` hint. Common red states:

| Check | Likely cause | Fix |
| --- | --- | --- |
| Schema version | Migration didn't run | Quit the app, re-launch (single-instance lock will let it through). If still broken, restore latest backup from `Settings → Data → Backups`. |
| DB writable | OS denied write to `userData/db/` | Check disk space + folder permissions. macOS: `~/Library/Application Support/LinkedIn Copilot/db/`. |
| DB integrity | SQLite reports corruption | Restore from a recent backup via Settings. Pre-restore snapshot is auto-created. |
| Playwright Chromium | Browser binary missing | Click "Install Chromium" inline on the Health page (runs `npx playwright install chromium` and streams progress). |
| LinkedIn session | Cookie expired or never set | Settings → Sessions → "Open LinkedIn login". Sign in once; cookies persist. |
| Sales Nav session | Required for InMail motion | Settings → Sessions → "Open Sales Nav login". Sales Nav has its own session that expires independently. |
| Anthropic API key | Not set, or set but invalid | Settings → API keys → paste sk-ant-... → Save → "Check key health" button. |
| Apollo API key | Not set (only matters in `api` mode) | Settings → API keys → paste apollo-... → Save → "Check key health". OR switch Apollo mode to `ui` / `auto` if you don't have a key. |
| OS keychain encryption | Linux without keyring/kwallet | Keys fall back to `PLAIN:` prefix in DB. Install `gnome-keyring` or `kwallet` to enable safeStorage. macOS / Windows have keychains by default. |
| Sends today | At/over INC-028 cap | Wait until tomorrow OR use the override prompt at send time (the soft-cap dialog lets you override per-send). |
| 24h drop rate | >10 drops in 24h | Sourcing pool may be bad. Re-pick the TAM account or broaden ICP titles. |

## 2. Check the recent log

On the Health page, scroll past Diagnostics to the "Recent log" panel. Color-coded levels (info/warn/error). Look for the most recent error line.

If you need older log entries: `Settings → Data → Open logs folder`. The full `main.log` lives there (electron-log keeps the last ~10 MB).

## 3. Common failure modes

### "research failed: LinkedIn redirected to login"
Your LinkedIn session expired mid-pipeline. The orchestrator emits an `auth_required` event automatically and the renderer auto-launches the login flow — sign in, the pipeline resumes from research.

If the auto-prompt didn't fire: Settings → Sessions → "Open LinkedIn login" manually, then re-run the prospect.

### "INC-028 weekly soft cap" / "daily soft cap"
You've hit the throttle. Send anyway via the override confirm prompt, or wait. The 7-day rolling window ages out automatically.

### "wrong-company mismatch: Apollo says X but LinkedIn shows Y"
Phase 1.5b dropped on the Raj Parmar pattern (Apollo employer ≠ LinkedIn employer). The drop is intentional — re-targeting at LinkedIn-shown company is your call.

### "career-arc mismatch: claims-ops (medium)"
Phase 4.5 detected a claims-ops trajectory in the prospect's full Experience history. The "Director of QA" title was misleading — they're operational claims QA, not software. Drop is correct in 95% of cases.

### "Connect button missing on control profile — likely INC-028 weekly cap soft-block"
LinkedIn has soft-blocked your account from sending connection requests. Wait 24-48h for the rolling window to recover. Don't override.

### "INC-030 stop-loss" (InMail)
Sales Nav credit charged but no thread created — LinkedIn-side block. Send queue caps retries at 1 for this pattern and auto-DNCs the prospect (audit trail in their DNC entry). The prospect won't be re-attempted.

### Hostile reply detected → auto-DNC
Reply classifier flagged the response as P4 (hostile / unsubscribe). DNC entry was added automatically. If you disagree (false positive), open the OutreachDetail and click "Reverse auto-DNC" in the reply card.

### Send queue is empty but a send "feels stuck"
- Open the Send Queue tab (`Cmd+4`). Anything in `running` for >2 min usually crashed the worker.
- Restart the app (window-all-closed → re-open). Single-instance lock prevents double-launch corruption.

### Bulk paste says "no valid LinkedIn URLs found"
- Sales Nav lead URLs (`/sales/lead/<URN>`) are not supported — paste the public profile URL (`linkedin.com/in/<slug>/`) instead.
- `/pub/` legacy URLs need a manual click-through to get the redirected `/in/` URL.
- The bulk paste preview shows invalid lines with reasons — expand the "Show invalid lines" details below the input.

### App won't launch / blank window
- Console: `npm run dev` from a terminal — Electron logs go there.
- If the renderer is blank but main is running: the renderer probably hit an unhandled error before any error boundary mounted. Check the log via Settings → Data → Open logs folder.
- Last resort: delete `userData/playwright-profile/` (forces re-login on next launch — keeps your DB).

## 4. Resetting state safely

Every destructive action takes a backup first. Order of escalation:

1. **Re-run onboarding** (Settings → Account → "Re-run onboarding") — keeps all data, just re-prompts the wizard.
2. **Re-import TAM** (Settings → Data → "Re-import TAM") — refreshes the seed list from the bundled CSV.
3. **Restore from backup** (Settings → Data → Backups → "Restore") — pre-restore snapshot is auto-created. App auto-reloads.
4. **Factory reset** (Settings → Advanced → typed-confirm gate) — currently a stub: it creates the backup but doesn't auto-wipe. Manual: quit app, delete `userData/db/app.sqlite*` files, re-launch.

## 5. Reporting bugs

Paste:
- The view you were on
- What you clicked / what happened
- The Health page screenshot if a check is red
- The relevant log lines from `Settings → Data → Open logs folder`

Or open a GitHub issue with the same info attached.

## 6. Common dev-environment gotchas

- **better-sqlite3 ABI mismatch** when running `node` directly: the binding is rebuilt for Electron's Node ABI by `electron-rebuild` (postinstall). `node scripts/smoke.mjs` skips DB checks gracefully when the binding can't load from plain Node.
- **Playwright doesn't auto-install Chromium on first `npm install`**: it's deferred. The Health page detects the missing binary on first launch and offers a one-click install button.
- **Renderer can't import main process code**: enforced by `eslint-plugin-import` no-restricted-paths. If you see a lint error about importing from `src/main`, you need an IPC route, not a direct import.
