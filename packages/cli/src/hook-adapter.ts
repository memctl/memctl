import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Agent =
  | "claude"
  | "cursor"
  | "windsurf"
  | "vscode"
  | "continue"
  | "zed"
  | "codex"
  | "cline"
  | "roo"
  | "amazonq"
  | "generic"
  | "all";

type CliFlags = Record<string, string | boolean>;

type AdapterFile = {
  path: string;
  content: string;
  executable?: boolean;
};

type AdapterBundle = {
  agent: Agent;
  files: AdapterFile[];
};

const DISPATCHER_FILENAME = "memctl-hook-dispatch.sh";

const SUPPORTED_AGENTS: Agent[] = [
  "claude",
  "cursor",
  "windsurf",
  "vscode",
  "continue",
  "zed",
  "codex",
  "cline",
  "roo",
  "amazonq",
  "generic",
];

const MEMCTL_REMINDER = 'Use memctl MCP tools for ALL persistent memory. Do NOT use built-in auto memory or MEMORY.md files. Do NOT store git logs, diffs, or file listings in memory. Session start: context action=bootstrap, session action=start, activity action=memo_read, branch action=get. Before editing: context action=context_for filePaths=[files], context action=smart_retrieve intent=<what you need>. Store decisions/lessons/issues: context action=functionality_set type=<type> id=<id> content=<content>. Search before storing: memory action=search query=<query>. After work: activity action=memo_leave message=<summary>. Session end: session action=end sessionId=<id> summary=<what was accomplished>.';

const DISPATCHER_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

PHASE="\${1:-}"
ROOT_DIR="\${MEMCTL_HOOK_ROOT:-.memctl/hooks}"
SESSION_FILE="\${ROOT_DIR}/session_id"
mkdir -p "\${ROOT_DIR}"

if [[ -z "\${PHASE}" ]]; then
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
  local s="\${1}"
  s="\${s//\\\\/\\\\\\\\}"
  s="\${s//\\"/\\\\\\"}"
  s="\${s//$'\\n'/\\\\n}"
  s="\${s//$'\\r'/\\\\r}"
  s="\${s//$'\\t'/\\\\t}"
  printf '%s' "\${s}"
}

extract_json_field() {
  local payload="\${1}"
  local phase="\${2}"
  HOOK_PAYLOAD="\${payload}" HOOK_PHASE="\${phase}" node -e '
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
  if [[ -n "\${MEMCTL_SESSION_ID:-}" ]]; then
    printf '%s' "\${MEMCTL_SESSION_ID}" > "\${SESSION_FILE}"
    printf '%s' "\${MEMCTL_SESSION_ID}"
    return
  fi

  if [[ -s "\${SESSION_FILE}" ]]; then
    cat "\${SESSION_FILE}"
    return
  fi

  local new_id
  new_id="$(memctl hook start | node -e 'const fs = require("node:fs"); const raw = fs.readFileSync(0, "utf8"); const parsed = JSON.parse(raw); process.stdout.write(parsed.sessionId || "");')"
  if [[ -z "\${new_id}" ]]; then
    echo "Failed to initialize memctl hook session" >&2
    exit 1
  fi
  printf '%s' "\${new_id}" > "\${SESSION_FILE}"
  printf '%s' "\${new_id}"
}

send_hook_payload() {
  local json_payload="\${1}"
  local log_file="\${ROOT_DIR}/hook.log"
  local result
  result="$(printf '%s' "\${json_payload}" | memctl hook --stdin 2>&1)" || true
  if [[ -n "\${MEMCTL_HOOK_DEBUG:-}" ]]; then
    printf '[%s] payload=%s result=%s\\n' "$(date +%H:%M:%S)" "\${json_payload}" "\${result}" >> "\${log_file}"
  fi
}

# Context reminder injected into Claude's context on every user prompt.
# This is what makes Claude reliably use memctl across turns.
MEMCTL_REMINDER='${MEMCTL_REMINDER}'

payload="$(read_payload)"

case "\${PHASE}" in
  start)
    session_id="$(ensure_session_id)"
    memctl hook start --session-id "\${session_id}" >/dev/null 2>&1 || true
    # Inject full instructions into context at session start
    printf '%s' "\${MEMCTL_REMINDER}"
    ;;
  user)
    session_id="$(ensure_session_id)"
    # Inject reminder into Claude's context using hookSpecificOutput.
    # Pure bash, no node spawn, runs on every turn so latency matters.
    printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}' "$(json_escape "\${MEMCTL_REMINDER}")"
    # Send turn data to API in background
    user_message="$(extract_json_field "\${payload}" "user")"
    if [[ -n "\${user_message}" ]]; then
      esc_msg="$(json_escape "\${user_message}")"
      esc_sid="$(json_escape "\${session_id}")"
      send_hook_payload "{\\"action\\":\\"turn\\",\\"sessionId\\":\\"\${esc_sid}\\",\\"userMessage\\":\\"\${esc_msg}\\"}" &
    fi
    ;;
  assistant)
    session_id="$(ensure_session_id)"
    assistant_message="$(extract_json_field "\${payload}" "assistant")"
    if [[ -n "\${assistant_message}" ]]; then
      esc_msg="$(json_escape "\${assistant_message}")"
      esc_sid="$(json_escape "\${session_id}")"
      send_hook_payload "{\\"action\\":\\"turn\\",\\"sessionId\\":\\"\${esc_sid}\\",\\"assistantMessage\\":\\"\${esc_msg}\\"}" &
    fi
    ;;
  compact)
    # Re-inject full instructions after context compaction
    printf '%s' "\${MEMCTL_REMINDER}"
    ;;
  end)
    session_id="$(ensure_session_id)"
    summary="$(extract_json_field "\${payload}" "summary")"
    esc_sid="$(json_escape "\${session_id}")"
    if [[ -n "\${summary}" ]]; then
      esc_sum="$(json_escape "\${summary}")"
      send_hook_payload "{\\"action\\":\\"end\\",\\"sessionId\\":\\"\${esc_sid}\\",\\"summary\\":\\"\${esc_sum}\\"}"
    else
      send_hook_payload "{\\"action\\":\\"end\\",\\"sessionId\\":\\"\${esc_sid}\\"}"
    fi
    rm -f "\${SESSION_FILE}"
    ;;
  *)
    echo "Unknown phase: \${PHASE}" >&2
    exit 1
    ;;
esac
`;

const CLAUDE_HOOKS_EXAMPLE = `{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./.memctl/hooks/memctl-hook-dispatch.sh start"
          }
        ]
      },
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "./.memctl/hooks/memctl-hook-dispatch.sh compact"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./.memctl/hooks/memctl-hook-dispatch.sh user"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./.memctl/hooks/memctl-hook-dispatch.sh assistant"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./.memctl/hooks/memctl-hook-dispatch.sh end"
          }
        ]
      }
    ]
  }
}
`;

const CURSOR_MCP_EXAMPLE = `{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const WINDSURF_MCP_EXAMPLE = `{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const VSCODE_MCP_EXAMPLE = `{
  "servers": {
    "memctl": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const CONTINUE_MCP_EXAMPLE = `name: memctl
version: 0.0.1
schema: v1
mcpServers:
  - name: memctl
    command: npx
    args:
      - "-y"
      - "memctl@latest"
    env:
      MEMCTL_API_URL: "https://memctl.com/api/v1"
      MEMCTL_ORG: "your-org"
      MEMCTL_PROJECT: "your-project"
`;

const ZED_MCP_EXAMPLE = `{
  "context_servers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const CLINE_MCP_EXAMPLE = `{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const ROO_MCP_EXAMPLE = `{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const AMAZONQ_MCP_EXAMPLE = `{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
`;

const CODEX_MCP_EXAMPLE = `[mcp_servers.memctl]
command = "npx"
args = ["-y", "memctl@latest"]

[mcp_servers.memctl.env]
MEMCTL_API_URL = "https://memctl.com/api/v1"
MEMCTL_ORG = "your-org"
MEMCTL_PROJECT = "your-project"
`;

const NO_NATIVE_HOOKS_NOTE = `# Hook support note

This agent does not expose a stable cross-platform hook event API for user prompt submit and assistant response.
Use the shared dispatcher with any external automation layer that can run shell commands:

1. Start session:
   ./.memctl/hooks/memctl-hook-dispatch.sh start
2. On user turn:
   echo '{"prompt":"<user message>"}' | ./.memctl/hooks/memctl-hook-dispatch.sh user
3. On assistant turn:
   echo '{"response":"<assistant message>"}' | ./.memctl/hooks/memctl-hook-dispatch.sh assistant
4. End session:
   ./.memctl/hooks/memctl-hook-dispatch.sh end
`;

const CODEX_EXAMPLE = `# Codex hook adapter

Codex Desktop and some Codex integrations do not expose a stable hook config API yet.
Use the dispatcher script from .memctl/hooks with any automation layer that can run shell commands.

Suggested phases:

1. Start session:
   ./.memctl/hooks/memctl-hook-dispatch.sh start

2. Before/after each prompt:
   echo '{"prompt":"<user message>"}' | ./.memctl/hooks/memctl-hook-dispatch.sh user
   echo '{"response":"<assistant message>"}' | ./.memctl/hooks/memctl-hook-dispatch.sh assistant

3. End session:
   ./.memctl/hooks/memctl-hook-dispatch.sh end
`;

const GENERIC_EXAMPLE = `# Generic adapter

Use this for any coding agent with command hooks:

1. On session start, run:
   ./.memctl/hooks/memctl-hook-dispatch.sh start

2. On user prompt submit (stdin JSON with prompt/message), run:
   ./.memctl/hooks/memctl-hook-dispatch.sh user

3. On assistant response (stdin JSON with response/text), run:
   ./.memctl/hooks/memctl-hook-dispatch.sh assistant

4. On session end, run:
   ./.memctl/hooks/memctl-hook-dispatch.sh end
`;

function normalizeAgent(value: string | undefined): Agent {
  const raw = (value ?? "generic").toLowerCase().trim();
  if (raw === "all") return "all";
  if (raw === "copilot" || raw === "github-copilot" || raw === "vs-code") {
    return "vscode";
  }
  if (raw === "claude-code" || raw === "claude-plugin") return "claude";
  if (raw === "amazon-q") return "amazonq";
  if (raw === "claude") return "claude";
  if (raw === "cursor") return "cursor";
  if (raw === "windsurf") return "windsurf";
  if (raw === "vscode") return "vscode";
  if (raw === "continue") return "continue";
  if (raw === "zed") return "zed";
  if (raw === "codex") return "codex";
  if (raw === "cline") return "cline";
  if (raw === "roo") return "roo";
  if (raw === "amazonq") return "amazonq";
  return "generic";
}

function getPresetFiles(agent: Exclude<Agent, "all">, dir: string): AdapterFile[] {
  if (agent === "claude") {
    return [
      {
        path: join(dir, "claude.settings.local.json.example"),
        content: CLAUDE_HOOKS_EXAMPLE,
      },
    ];
  }

  if (agent === "cursor") {
    return [
      { path: join(dir, "cursor.mcp.json.example"), content: CURSOR_MCP_EXAMPLE },
      { path: join(dir, "cursor.hooks.md.example"), content: NO_NATIVE_HOOKS_NOTE },
    ];
  }

  if (agent === "windsurf") {
    return [
      {
        path: join(dir, "windsurf.mcp_config.json.example"),
        content: WINDSURF_MCP_EXAMPLE,
      },
      {
        path: join(dir, "windsurf.hooks.md.example"),
        content: NO_NATIVE_HOOKS_NOTE,
      },
    ];
  }

  if (agent === "vscode") {
    return [
      { path: join(dir, "vscode.mcp.json.example"), content: VSCODE_MCP_EXAMPLE },
      { path: join(dir, "vscode.hooks.md.example"), content: NO_NATIVE_HOOKS_NOTE },
    ];
  }

  if (agent === "continue") {
    return [
      {
        path: join(dir, "continue.config.yaml.example"),
        content: CONTINUE_MCP_EXAMPLE,
      },
      {
        path: join(dir, "continue.hooks.md.example"),
        content: NO_NATIVE_HOOKS_NOTE,
      },
    ];
  }

  if (agent === "zed") {
    return [
      { path: join(dir, "zed.settings.json.example"), content: ZED_MCP_EXAMPLE },
      { path: join(dir, "zed.hooks.md.example"), content: NO_NATIVE_HOOKS_NOTE },
    ];
  }

  if (agent === "codex") {
    return [
      {
        path: join(dir, "codex.config.toml.example"),
        content: CODEX_MCP_EXAMPLE,
      },
      { path: join(dir, "codex.hooks.md.example"), content: CODEX_EXAMPLE },
    ];
  }

  if (agent === "cline") {
    return [
      { path: join(dir, "cline.mcp.json.example"), content: CLINE_MCP_EXAMPLE },
      { path: join(dir, "cline.hooks.md.example"), content: NO_NATIVE_HOOKS_NOTE },
    ];
  }

  if (agent === "roo") {
    return [
      { path: join(dir, "roo.mcp.json.example"), content: ROO_MCP_EXAMPLE },
      { path: join(dir, "roo.hooks.md.example"), content: NO_NATIVE_HOOKS_NOTE },
    ];
  }

  if (agent === "amazonq") {
    return [
      {
        path: join(dir, "amazonq.mcp.json.example"),
        content: AMAZONQ_MCP_EXAMPLE,
      },
      {
        path: join(dir, "amazonq.hooks.md.example"),
        content: NO_NATIVE_HOOKS_NOTE,
      },
    ];
  }

  return [{ path: join(dir, "generic.hooks.md.example"), content: GENERIC_EXAMPLE }];
}

function getAdapterBundle(agent: Agent, dir: string): AdapterBundle {
  const targetAgents =
    agent === "all" ? SUPPORTED_AGENTS : [agent as Exclude<Agent, "all">];
  const byPath = new Map<string, AdapterFile>();

  const baseFile: AdapterFile = {
    path: join(dir, DISPATCHER_FILENAME),
    content: DISPATCHER_SCRIPT,
    executable: true,
  };
  byPath.set(baseFile.path, baseFile);

  for (const target of targetAgents) {
    const files = getPresetFiles(target as Exclude<Agent, "all">, dir);
    for (const file of files) {
      byPath.set(file.path, file);
    }
  }

  return { agent, files: [...byPath.values()] };
}

async function writeBundle(bundle: AdapterBundle): Promise<string[]> {
  const written: string[] = [];
  for (const file of bundle.files) {
    const abs = resolve(file.path);
    const parent = dirname(abs);
    await mkdir(parent, { recursive: true });
    await writeFile(abs, file.content, "utf-8");
    if (file.executable) {
      await chmod(abs, 0o755);
    }
    written.push(abs);
  }
  return written;
}

export async function runHookAdapterCommand(input: {
  positional: string[];
  flags: CliFlags;
}): Promise<Record<string, unknown>> {
  const agent = normalizeAgent(
    (input.flags.agent as string | undefined) ?? input.positional[0],
  );
  const dir = resolve((input.flags.dir as string | undefined) ?? ".memctl/hooks");
  const write = input.flags.write === true;
  const bundle = getAdapterBundle(agent, dir);

  if (!write) {
    return {
      agent,
      dir,
      supportedAgents: SUPPORTED_AGENTS,
      files: bundle.files.map((file) => ({
        path: resolve(file.path),
        executable: file.executable === true,
        content: file.content,
      })),
      hint: "Pass --write to create files on disk.",
    };
  }

  const written = await writeBundle(bundle);
  return {
    agent,
    dir,
    supportedAgents: SUPPORTED_AGENTS,
    written,
    nextSteps: [
      "Copy the generated agent config examples into your project or global agent settings.",
      "For Claude plugin marketplace, use /plugin marketplace add memctl/memctl.",
      "Keep memctl-hook-dispatch.sh in your repo and make sure it stays executable.",
    ],
  };
}
