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

# Escape a string for safe embedding in JSON values.
# Handles backslash, double quote, newline, carriage return, and tab.
json_escape() {
  local s="${1}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "${s}"
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
    } else if (phase === "assistant") {
      process.stdout.write(
        pick(payload, [
          "response",
          "assistant_response",
          "output",
          "text",
          "content",
        ]),
      );
    } else if (phase === "summary") {
      process.stdout.write(
        pick(payload, ["summary", "message", "reason", "text", "content"]),
      );
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
  local log_file="${ROOT_DIR}/hook.log"
  local result
  result="$(printf '%s' "${json_payload}" | memctl hook --stdin 2>&1)" || true
  if [[ -n "${MEMCTL_HOOK_DEBUG:-}" ]]; then
    printf '[%s] payload=%s result=%s\n' "$(date +%H:%M:%S)" "${json_payload}" "${result}" >> "${log_file}"
  fi
}

# Context reminder injected into Claude's context on every user prompt.
# This is what makes Claude reliably use memctl across turns.
MEMCTL_REMINDER='Use memctl MCP tools for ALL persistent memory. Do NOT use built-in auto memory or MEMORY.md files. Do NOT store code, git output, file contents, or command results in memory. Session start: context action=bootstrap, session action=start, activity action=memo_read, branch action=get. Before editing: context action=context_for filePaths=[files], context action=smart_retrieve intent=<what you need>. Store decisions/lessons/issues: context action=functionality_set type=<type> id=<id> content=<content>. Search before storing: memory action=search query=<query>. MANDATORY SESSION END: After fully responding to the user, you MUST run: 1) activity action=memo_leave message=<handoff note>, 2) session action=end sessionId=<id> summary=<what was accomplished, key decisions, open questions, files modified>. Never skip session end. Never store code or transient data.'

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
    # Inject reminder into Claude's context using hookSpecificOutput.
    # Pure bash, no node spawn, runs on every turn so latency matters.
    printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}' "$(json_escape "${MEMCTL_REMINDER}")"
    # Send turn data to API in background
    user_message="$(extract_json_field "${payload}" "user")"
    if [[ -n "${user_message}" ]]; then
      esc_msg="$(json_escape "${user_message}")"
      esc_sid="$(json_escape "${session_id}")"
      send_hook_payload "{\"action\":\"turn\",\"sessionId\":\"${esc_sid}\",\"userMessage\":\"${esc_msg}\"}" &
    fi
    ;;
  assistant)
    session_id="$(ensure_session_id)"
    assistant_message="$(extract_json_field "${payload}" "assistant")"
    if [[ -n "${assistant_message}" ]]; then
      esc_msg="$(json_escape "${assistant_message}")"
      esc_sid="$(json_escape "${session_id}")"
      send_hook_payload "{\"action\":\"turn\",\"sessionId\":\"${esc_sid}\",\"assistantMessage\":\"${esc_msg}\"}" &
    fi
    ;;
  compact)
    # Re-inject full instructions after context compaction
    printf '%s' "${MEMCTL_REMINDER}"
    ;;
  end)
    session_id="$(ensure_session_id)"
    summary="$(extract_json_field "${payload}" "summary")"
    esc_sid="$(json_escape "${session_id}")"
    if [[ -n "${summary}" ]]; then
      esc_sum="$(json_escape "${summary}")"
      send_hook_payload "{\"action\":\"end\",\"sessionId\":\"${esc_sid}\",\"summary\":\"${esc_sum}\"}"
    else
      send_hook_payload "{\"action\":\"end\",\"sessionId\":\"${esc_sid}\"}"
    fi
    rm -f "${SESSION_FILE}"
    ;;
  *)
    echo "Unknown phase: ${PHASE}" >&2
    exit 1
    ;;
esac
