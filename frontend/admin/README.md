# Snackforest Admin Frontend

This directory hosts the modular Admin dashboard scripts. Each feature lives in `js/` as a self-registering IIFE that augments the shared `window.SFAdmin` namespace.

## Module Loading

- `main.js` sequentially loads every module to preserve dependency order without bundlers.
- `admin.js` remains as a compatibility wrapper for legacy pages that still reference the old bundle name.

## Core Architecture

- `js/env.js` seeds global config and shared state containers.
- `js/core.js` provides the event bus (`Admin.core.emit/on/off`), notification helpers, and guard utilities.
- Feature modules (`products.js`, `categories.js`, `orders.js`, `carousel.js`, `site-config.js`, etc.) subscribe to events and emit updates instead of calling each other directly.
- `js/data.js` centralises data fetching with cache metadata and TTL support. Modules request datasets via `ensure*` helpers and respond to broadcast events.
- `js/init.js` performs DOM verification and triggers the initial data warm-up, deferring to the event bus for follow-up work.

### Event Conventions

- `*:loaded` signals that a dataset has been fetched and rendered for the first time.
- `*:updated` indicates data mutations or forced refreshes.
- `core:notify` events drive the shared notification layer; prefer `Admin.core.notifySuccess|Warning|Error` helpers.

## Error Handling

- Use `Admin.core.handleError(error, friendlyMessage)` from feature modules to surface API failures. This helper logs the error, pops a toast, and dispatches `core:error` for observability dashboards.
- Optimistic flows should revert local state when errors occur and leave a concise notification for the operator.

## Testing

Automated tests run with [Vitest](https://vitest.dev/). A starter spec validates the shared utilities.

```bash
cd frontend/admin
npm install
npm test
```

Add additional specs under `frontend/admin/tests/`. If a module depends on DOM APIs, enable the `jsdom` environment within its suite (`vi.useFakeTimers()` is already demonstrated in the starter test).

### Without npm installed

Open `frontend/admin/tests/runner.html` directly in a browser to execute a lightweight harness that covers shared utilities, the data cache layer, and navigation behaviours. The page renders pass/fail cards and avoids any dependency installation, making it useful on locked-down environments.

## Coding Style

- Stick to vanilla ES2019 syntax to keep compatibility with older browsers that the dashboard still supports.
- Keep modules self-registering through `window.SFAdmin`; avoid introducing top-level `export`/`import` until a bundler is in place.
- Favour event-based coordination (`Admin.core.emit`) over cross-module imports to prevent tight coupling.
- UI messages should be routed through `Admin.core.notify*` helpers; reserve `alert()` for offline fallbacks only.

## Next Steps

- Expand test coverage across feature modules (navigation flows, debounce handlers, optimistic updates).
- Consider wiring a lightweight build step (Vite/Rollup) once backend delivery endpoints stabilise.
- Document new events in `API-TOOLS.md` when backend contracts evolve.
