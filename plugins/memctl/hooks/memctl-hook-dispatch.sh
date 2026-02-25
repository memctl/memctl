#!/usr/bin/env bash
set -euo pipefail

PHASE="${1:-}"
ROOT_DIR="${MEMCTL_HOOK_ROOT:-.memctl/hooks}"
SESSION_FILE="${ROOT_DIR}/session_id"
mkdir -p "${ROOT_DIR}"

if [[ -z "${PHASE}" ]]; then
  echo "Usage: memctl-hook-dispatch.sh <start|user|assistant|end>" >&2
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

payload="$(read_payload)"
session_id="$(ensure_session_id)"

case "${PHASE}" in
  start)
    memctl hook start --session-id "${session_id}" >/dev/null 2>&1 || true
    ;;
  user)
    user_message="$(extract_json_field "${payload}" "user")"
    if [[ -n "${user_message}" ]]; then
      json="$(HOOK_MESSAGE="${user_message}" HOOK_SESSION_ID="${session_id}" node -e '
        const message = process.env.HOOK_MESSAGE || "";
        const sessionId = process.env.HOOK_SESSION_ID || "";
        process.stdout.write(JSON.stringify({ action: "turn", sessionId, userMessage: message }));
      ')"
      send_hook_payload "${json}"
    fi
    ;;
  assistant)
    assistant_message="$(extract_json_field "${payload}" "assistant")"
    if [[ -n "${assistant_message}" ]]; then
      json="$(HOOK_MESSAGE="${assistant_message}" HOOK_SESSION_ID="${session_id}" node -e '
        const message = process.env.HOOK_MESSAGE || "";
        const sessionId = process.env.HOOK_SESSION_ID || "";
        process.stdout.write(JSON.stringify({ action: "turn", sessionId, assistantMessage: message }));
      ')"
      send_hook_payload "${json}"
    fi
    ;;
  end)
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
