#!/usr/bin/env bash
set -euo pipefail

PHASE="${1:-}"
ROOT_DIR="${MEMCTL_HOOK_ROOT:-.memctl/hooks}"
SESSION_FILE="${ROOT_DIR}/session_id"
mkdir -p "${ROOT_DIR}"

if [[ -z "${PHASE}" ]]; then
  echo "Usage: memctl-hook-dispatch.sh <start|user|assistant|end|compact>" >&2
  exit 1
fi

read_payload() {
  if [ -t 0 ]; then
    printf '{}'
  else
    cat
  fi
}

extract_json_field() {
  local payload="${1}"
  local phase="${2}"
  HOOK_PAYLOAD="${payload}" HOOK_PHASE="${phase}" node -e '
    const payloadRaw = process.env.HOOK_PAYLOAD || "{}";
    const phase = process.env.HOOK_PHASE || "";
    let payload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      payload = {};
    }

    const pick = (obj, keys) => {
      for (const key of keys) {
        const value = obj?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return "";
    };

    if (phase === "user") {
      process.stdout.write(
        pick(payload, ["prompt", "user_message", "message", "text", "content"]),
      );
      return;
    }

    if (phase === "assistant") {
      process.stdout.write(
        pick(payload, [
          "response",
          "assistant_response",
          "output",
          "text",
          "content",
        ]),
      );
      return;
    }

    if (phase === "summary") {
      process.stdout.write(
        pick(payload, ["summary", "message", "reason", "text", "content"]),
      );
      return;
    }
  '
}

ensure_session_id() {
  if [[ -n "${MEMCTL_SESSION_ID:-}" ]]; then
    printf '%s' "${MEMCTL_SESSION_ID}" > "${SESSION_FILE}"
    printf '%s' "${MEMCTL_SESSION_ID}"
    return
  fi

  if [[ -s "${SESSION_FILE}" ]]; then
    cat "${SESSION_FILE}"
    return
  fi

  local new_id
  new_id="$(memctl hook start | node -e 'const fs = require("node:fs"); const raw = fs.readFileSync(0, "utf8"); const parsed = JSON.parse(raw); process.stdout.write(parsed.sessionId || "");')"
  if [[ -z "${new_id}" ]]; then
    echo "Failed to initialize memctl hook session" >&2
    exit 1
  fi
  printf '%s' "${new_id}" > "${SESSION_FILE}"
  printf '%s' "${new_id}"
}

send_hook_payload() {
  local json_payload="${1}"
  printf '%s' "${json_payload}" | memctl hook --stdin >/dev/null 2>&1 || true
}

# Context reminder injected into Claude's context on every user prompt.
# This is what makes Claude reliably use memctl across turns.
MEMCTL_REMINDER='Use the memctl MCP tools for persistent memory. If you have not bootstrapped context yet this session, call the context tool with {"action":"bootstrap"} and the session tool with {"action":"start","sessionId":"<unique-id>","autoExtractGit":true}. Before editing files, call context with {"action":"context_for","filePaths":[...]}. Store important decisions with the memory tool. At session end, call session with {"action":"end"}.'

payload="$(read_payload)"

case "${PHASE}" in
  start)
    session_id="$(ensure_session_id)"
    memctl hook start --session-id "${session_id}" >/dev/null 2>&1 || true
    # Inject full instructions into context at session start
    printf '%s' "${MEMCTL_REMINDER}"
    ;;
  user)
    session_id="$(ensure_session_id)"
    # Inject reminder into Claude's context via additionalContext (stdout)
    node -e '
      const reminder = process.env.MEMCTL_REMINDER || "";
      process.stdout.write(JSON.stringify({ additionalContext: reminder }));
    '
    # Send turn data to API in background
    user_message="$(extract_json_field "${payload}" "user")"
    if [[ -n "${user_message}" ]]; then
      json="$(HOOK_MESSAGE="${user_message}" HOOK_SESSION_ID="${session_id}" node -e '
        const message = process.env.HOOK_MESSAGE || "";
        const sessionId = process.env.HOOK_SESSION_ID || "";
        process.stdout.write(JSON.stringify({ action: "turn", sessionId, userMessage: message }));
      ')"
      send_hook_payload "${json}" &
    fi
    ;;
  assistant)
    session_id="$(ensure_session_id)"
    assistant_message="$(extract_json_field "${payload}" "assistant")"
    if [[ -n "${assistant_message}" ]]; then
      json="$(HOOK_MESSAGE="${assistant_message}" HOOK_SESSION_ID="${session_id}" node -e '
        const message = process.env.HOOK_MESSAGE || "";
        const sessionId = process.env.HOOK_SESSION_ID || "";
        process.stdout.write(JSON.stringify({ action: "turn", sessionId, assistantMessage: message }));
      ')"
      send_hook_payload "${json}" &
    fi
    ;;
  compact)
    # Re-inject full instructions after context compaction
    printf '%s' "${MEMCTL_REMINDER}"
    ;;
  end)
    session_id="$(ensure_session_id)"
    summary="$(extract_json_field "${payload}" "summary")"
    json="$(HOOK_SUMMARY="${summary}" HOOK_SESSION_ID="${session_id}" node -e '
      const summary = process.env.HOOK_SUMMARY || "";
      const sessionId = process.env.HOOK_SESSION_ID || "";
      process.stdout.write(JSON.stringify({ action: "end", sessionId, summary: summary || undefined }));
    ')"
    send_hook_payload "${json}"
    rm -f "${SESSION_FILE}"
    ;;
  *)
    echo "Unknown phase: ${PHASE}" >&2
    exit 1
    ;;
esac
