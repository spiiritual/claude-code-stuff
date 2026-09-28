# claude-code-stuff

A Claude Code plugin marketplace.

```
/plugin marketplace add spiiritual/claude-code-stuff
/plugin install better-compaction@claude-code-stuff
```

## better-compaction

A Claude Mod that fixes two things about compaction:

- **Waits for the turn to end.** Auto-compaction no longer interrupts the model mid-turn; it runs as soon as the turn finishes. Past 90% of the context window, or after a prompt-too-long error, it compacts mid-turn as usual.
- **Summarizes at its own effort.** The summary runs at a lower effort than the conversation (default `medium`). The model stays the same, so the prompt cache is kept. Subagents running during a summary keep their own effort.

Mods need function hooks on. Add this to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Settings, in `/config`:

| Option | Default | |
|---|---|---|
| `deferCompaction` | on | Wait for the turn to end before compacting |
| `compactionEffort` | `medium` | `inherit`, `low`, `medium`, `high`, `xhigh` or `max` |

Measured on a 214k-token session (3 runs each, recall quiz of 22 facts):

| Effort | Summary time | Quiz |
|---|---|---|
| low | 31s | 20.2 |
| medium | 46s | 20.8 |
| high | 59s | 20.7 |
| xhigh | 76s | 19.8 |
| max | 164s | 20.8 |

Recall was the same within noise at every level, while time grew with effort.

In headless mode (`-p`, SDK) the deferred compaction runs at the start of the next prompt instead of right after the turn.
