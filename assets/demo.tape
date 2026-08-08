# assets/demo.tape — source for README's demo GIF. Re-render with:
#
#   export MAINDALA_API_KEY=mt_<your throwaway token>   # from `maindala tail --signup <email>`
#   vhs assets/demo.tape
#
# MAINDALA_API_KEY must be a throwaway/disposable token — never a real
# project's. It is read from the environment only; it is never typed, echoed,
# or otherwise rendered on screen — the metadata-only + no-secret-on-camera
# guardrails this recording follows. The on-camera command is deliberately
# just `maindala tail` — no --signup, no login, no token — to keep the
# credential fully off-camera.
#
# assets/emit-demo-events.mjs pushes real events to the live ingest endpoint
# (same wire contract as pushToolCallTelemetry) so the stream shown is
# genuine, not faked/hand-typed terminal output.

Output assets/demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 940
Set Height 480
Set Padding 20
Set Theme "Dracula"
Set TypingSpeed 60ms
Set Framerate 24

# ── Hidden setup: install the CLI + schedule the event emitter ─────────────
# Everything in this block is off-camera — never appears in the rendered GIF.
Hide
Type "npm install -g maindala >/dev/null 2>&1"
Enter
Sleep 5s
Type "(sleep 3 && node assets/emit-demo-events.mjs >/dev/null 2>&1) &"
Enter
Sleep 300ms
Type "clear"
Enter
Show

# ── On-camera: the real command, the real live stream ───────────────────────
Type "maindala tail"
Enter
Sleep 10s
