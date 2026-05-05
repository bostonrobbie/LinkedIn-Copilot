# ADR 0001 — Electron over Tauri

**Status:** accepted, May 4, 2026
**Context:** picking a desktop runtime for the MVP

## Decision

Use Electron 33 + Vite + TypeScript.

## Why not Tauri

Tauri produces smaller binaries (5–10 MB vs 200+ MB) and lower memory baseline. We considered it.

We rejected Tauri because:

1. **Playwright is the agent's most important dependency.** Playwright runs Chromium (the same engine Electron ships) under the hood. With Tauri (which uses the platform webview — WKWebView on macOS, WebView2 on Windows), we'd run Chromium twice: once for the UI shell, once for Playwright. With Electron we run Chromium once for the UI and once for the Playwright session. Same total footprint either way.
2. **better-sqlite3 native binding.** Electron has a mature `electron-rebuild` story; Tauri pushes you toward Rust SQLite (sqlx / sea-orm). We'd lose the synchronous query ergonomics.
3. **Anthropic SDK is JavaScript-first.** Going Rust would mean re-implementing the SDK or shelling out.
4. **Maturity.** Electron has 10+ years of production history (VSCode, Slack, Discord). Tauri is well-built but fewer hard-mode edge cases worked through.

## Tradeoffs

- Distribution size: 200+ MB unpacked, ~80–100 MB compressed installer. Acceptable for a daily-use BDR tool.
- Memory: ~150 MB for the UI shell + whatever Playwright uses. Not a constraint on a sales rep's laptop.
- Security: Electron's main/renderer separation requires discipline (we enforce via `eslint-plugin-import` no-restricted-imports rules and `contextBridge`).

## When to revisit

If the app ever ships to consumers (vs sales reps with workstations) or distribution size becomes a constraint, reopen this decision.
