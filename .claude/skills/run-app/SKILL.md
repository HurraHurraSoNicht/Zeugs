---
name: run-app
description: Start this Expo/React Native app and view its rendered UI. Use when asked to run, start, launch, or screenshot this app, or to confirm a change works. No Android emulator/device is confirmed available on this machine, so the verified path is Expo's web preview (react-native-web) driven headlessly via the claude-in-chrome browser tools.
---

# Running the Zeugs app (Expo / React Native)

This is an Expo SDK 57 + TypeScript project (React Native 0.86). There is no
Android emulator or physical device confirmed connected on this machine, so
the verified way to *see* the UI is Expo's web target
(`react-native-web`), driven with the `claude-in-chrome` skill/tools.

Web support is already installed (`react-dom`, `react-native-web`,
`@expo/metro-runtime`). If `package.json` is missing them, install first:

```powershell
npx expo install react-dom react-native-web @expo/metro-runtime
```

## Windows PATH gotcha (must read)

Node/npm/npx are installed at `C:\Program Files\nodejs`, but PowerShell tool
invocations do **not** inherit an updated PATH automatically — each call is a
fresh process. Every PowerShell command that needs `node`/`npm`/`npx` must
refresh PATH from the registry first, in the SAME command:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
npx expo start --web --port 8098
```

In Git Bash, prepend instead:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

## Launch

Start the web dev server in the background on a fixed port (avoids the
interactive "port in use" prompt hanging in non-interactive mode):

```bash
cd "/c/Users/thors/Zeugs" && export PATH="/c/Program Files/nodejs:$PATH" && CI=1 npx expo start --web --port 8098
```

Run this with `run_in_background: true` (Bash tool). Then poll instead of
sleeping blindly:

```bash
timeout 40 bash -c 'until curl -sf http://localhost:8098 >/dev/null 2>&1; do sleep 1; done' && echo "SERVER UP"
```

If port 8098 is already bound (e.g. a previous run left node processes
alive), check with PowerShell:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, StartTime
```

Stop leftover processes before relaunching:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

(Backgrounding `npx expo start &` inside a Bash tool call that is *itself*
already `run_in_background` can silently detach the real process — the
wrapper script reports "completed" while Metro keeps running unseen. Prefer
passing the `npx expo start ...` command directly as the backgrounded Bash
command, not wrapped in an extra `&`.)

## Drive it (claude-in-chrome)

No project-specific auth or login flow exists yet (no auth screens built).
One representative interaction that proves the app is running:

1. Load the browser tools (batch in one ToolSearch call):
   `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__find`
2. `tabs_context_mcp` with `createIfEmpty: true` to get a tab.
3. `browser_batch`: `navigate` to `http://localhost:8098` → `wait` ~5s (first
   Metro bundle compile is slow) → `screenshot` (`save_to_disk: true`).
   Expect the **Entdecken** screen: a header "Entdecken" and a FlatList of
   mock product cards (image, name, brand, star rating like "4.5 (128)").
4. To prove tab navigation works, use `find` with a query like
   `"Favoriten tab button in bottom navigation bar"` to get a `ref`, then
   `computer` `left_click` on that `ref` (NOT raw coordinates — the bottom
   tab bar's pixel position shifts slightly between runs/viewport sizes and
   coordinate clicks silently no-op without erroring). Screenshot again to
   confirm the header changes to "Favoriten" and the tab shows as active.
   Repeat for "Profil".
5. Check `read_console_messages` (pattern `error|Error`) — should be empty
   besides the normal Expo bundler startup log line.

## Stale Metro cache (must read if UI doesn't reflect recent edits)

Metro's on-disk transform cache can serve **stale code after source edits** even
across a fresh `navigate()`/full page reload with a new 200 response — the
bundle response looked "fresh" but didn't contain newly-added
exports/components. Confirmed by fetching the bundle URL directly and
checking `text.includes('SomeNewSymbol')`. If a UI change doesn't show up
(clicks silently no-op, new text never appears) after confirming there are no
console errors, don't assume the code is wrong — first rule out a stale
bundle:

```bash
cd "/c/Users/thors/Zeugs" && export PATH="/c/Program Files/nodejs:$PATH" && CI=1 npx expo start --web --port 8098 --clear
```

The `--clear` flag resets Metro's cache. Kill any old node processes first
(see below) before starting the `--clear` run, then re-verify.

## Stop (only when asked, or to force a clean restart)

**Default as of 2026-07-31: leave the server running after verification —
do not stop it.** The user wants `localhost:8098` to keep working after the
session ends; stopping it every time was confusing (it looked like closing
the browser tab killed the server, but really it was this skill's old
default). Only stop it when the user explicitly asks, or when you need a
clean restart to pick up a code change (stop, then immediately start again
with `--clear` — see above):

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

If you do stop it as part of a restart, don't end the task there — confirm
the server is back up (`curl`) before finishing.

## Gotchas hit while building this skill

- `create-expo-app` refuses to scaffold into a non-empty directory unless
  the extra files are on its small allowlist (`.git`, `README.md` is
  actually NOT on it, nor is a custom `supabase/` folder) — irrelevant for
  day-to-day running, but relevant if the project is ever re-scaffolded.
- Raw pixel-coordinate clicks on the bottom tab bar looked like they
  "worked" (no error) but didn't actually switch tabs — always resolve the
  tab button via `find` → `ref` first.
