---
name: restart-server
description: Quickly stop and restart the Expo web dev server for this app. Use whenever the user reports "localhost geht nicht" / "localhost doesn't work" / the page won't load / a previous session's dev server was stopped and they want it running again. This is the fast path for just getting the server back up — for full UI verification (screenshots, clicking through screens) use the run-app skill instead.
---

# Restart the Expo dev server

**Default as of 2026-07-31: leave the server running after starting it —
do not stop it at the end of a task.** Earlier sessions stopped it after
every verification (to avoid orphaned processes), which meant
`localhost:8098` went dead the moment the user tried it later on their own
— confusing, since closing a browser tab has nothing to do with whether the
server process is alive. The user asked for it to just stay up. Only stop
it when: the user explicitly asks, or you need a clean restart after a code
change that isn't reflected (stale bundle) — and in that case, immediately
start it again rather than leaving it down.

This skill is the fast, minimal fix for "it's not running right now": get
it running again, verified with a single `curl`, without necessarily doing
full browser-based UI checks.

## Windows PATH gotcha (see also the run-app skill)

PowerShell tool calls don't inherit an updated PATH automatically. Every
PowerShell command touching `node`/`npm`/`npx` must refresh PATH from the
registry first, in the same command:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
```

In Git Bash, prepend instead: `export PATH="/c/Program Files/nodejs:$PATH"`.

## Steps

1. Check whether a server is already running (avoids a redundant restart or
   a port conflict):

```powershell
(Get-Process node -ErrorAction SilentlyContinue | Measure-Object).Count
```

If this is `0`, that confirms the server is down — proceed to start it.
If it's non-zero, a server may already be running; try `curl -sf
http://localhost:8098` first before restarting anything.

2. If something is running but unresponsive, or you just want a clean
   slate, stop it first:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

3. Start it in the background (Bash tool, `run_in_background: true`):

```bash
cd "/c/Users/thors/Zeugs" && export PATH="/c/Program Files/nodejs:$PATH" && CI=1 npx expo start --web --port 8098
```

Only add `--clear` if recent source edits don't seem to be reflected once
the server is up (stale Metro transform cache — see the run-app skill's
"Stale Metro cache" section) — it costs a few extra seconds and isn't
needed for a plain restart.

4. Poll instead of guessing when it's ready:

```bash
timeout 40 bash -c 'until curl -sf http://localhost:8098 >/dev/null 2>&1; do sleep 1; done' && echo "SERVER UP" || echo "TIMEOUT"
```

5. Tell the user it's back up at `http://localhost:8098` — no need to also
   screenshot/click through the app unless they ask for that (that's the
   `run-app` skill's job).

## Related skills

- `run-app` — full launch + browser-driven verification (screenshots,
  clicking through screens), including the stale-cache gotcha in more detail.
- `openfoodfacts-api` — unrelated to server restarts, but if a restart was
  prompted by an Admin-screen search error, check there first (rate-limit
  cooldown vs. an actual server-down issue are easy to conflate).
