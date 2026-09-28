# claude-code-stuff

A Claude Code plugin marketplace.

```
/plugin marketplace add spiiritual/claude-code-stuff
/plugin install better-compaction@claude-code-stuff
```

## better-compaction

A Claude Mod that fixes two things about compaction:

- **Waits for the turn to end.** Auto-compaction no longer interrupts the model mid-turn; it runs as soon as the turn finishes. Past 80% of the context window (configurable), or after a prompt-too-long error, it compacts mid-turn as usual.
- **Summarizes at its own effort.** The summary runs at a lower effort than the conversation (default `medium`). The model stays the same, so the prompt cache is kept. Subagents running during a summary keep their own effort.

Mods need function hooks on. Add this to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Settings, in `/config`:

| Option | Default | |
|---|---|---|
| `deferCompaction` | on | Wait for the turn to end before compacting |
| `deferUnderPercent` | `80` | Stop waiting once the context is this full (% of the window) |
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

## whiteboard-defense

```
/plugin install whiteboard-defense@claude-code-stuff
```

For Mitchell Hashimoto's [whiteboard defense](https://x.com/mitchellh): you should be able to explain any customer-facing system you ship and defend its decisions, even if Claude wrote the code.

- **`/whiteboard-defense plan`** replaces the written plan. Claude draws the system as a real diagram, asks you the decisions that matter as consequence stories ("server dies mid-refund: customer charged with no refund, or refund 30s late?"), then has you explain it back.
- **`/whiteboard-defense grill`** quizzes you after building: why X over Y, what a malicious user can do, where it fails. Answers are graded against the code, and drift from the plan is flagged.

Plans are saved as cards in the plugin's data folder, never in your repo.

The diagrams are pictures drawn in the transcript by a mod, so they need function hooks on (see above), macOS (it renders with the built-in `qlmanage`), and a terminal that shows images (Ghostty, kitty, iTerm2, WezTerm; not tmux). Anywhere else you get a text diagram.
