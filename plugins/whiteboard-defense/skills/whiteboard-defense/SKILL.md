---
name: whiteboard-defense
description: Use when planning or finishing customer-facing work, so the user understands what ships and can defend it. Plan mode replaces a written plan with a diagram, consequence-story decisions the user makes, and a teach-back. Grill mode quizzes the user on a built system. Triggers on "whiteboard", "defend this", "grill me", "quiz me on what we built", "whiteboard-defense".
argument-hint: "[plan | grill] [topic]"
---

# Whiteboard defense

The user must be able to explain any customer-facing system they ship: why X over Y, what a malicious actor can do, what data structure and why, where it fails. Line-level details (function names, exact code) don't matter.

Reading a plan doesn't build that understanding. People skim walls of text, can't judge options they have no picture of, and say yes. So: **picture first, decisions as consequences, then the user explains it back.**

## When to use it

The test is who gets hurt if it's wrong. Use it when a change touches customers, their data or their money, even indirectly: an internal tool that reads customer data counts, and so does a one-line change to auth, rate limits or billing. Also use it when a prototype is about to become the real thing.

Skip it for PoCs, demos, experiments and throwaway scripts: speed wins there. Skip it for refactors too, unless the behavior might change.

When you notice customer-facing work and the user didn't ask for this, offer it once in one line ("This touches billing; want to whiteboard it first?"). Don't insist.

## Cards

A card is the whiteboard for one topic: the diagram and the decisions the user made. Keep cards at `${CLAUDE_PLUGIN_DATA}/cards/<repo folder name>/<topic>.md`, never in the repo.

~~~markdown
# <topic>
<one sentence: what this system does for the customer>

## Diagram
```svg
<the draw tool's body, width and height in a comment on the first line>
```

## Decisions
1. **<situation>** chose <A> over <B>, because <consequence in the user's words>. Fails when <...>.

## In their words
<the user's teach-back, verbatim>
~~~

## Drawing

Call the `draw` tool (`mcp__whiteboard-defense__draw`). At most 7 boxes, a label on each arrow, and an orange numbered badge on the box or arrow each decision is about. Dashed (`async`) for anything that happens later or comes from outside. Look at the picture it returns: redraw if an arrow misses its box or text overlaps. If the tool fails, show the `alt` text diagram instead. If the tool is missing, mods are off: show the text diagram and tell the user in one line to add `"env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" }` to `~/.claude/settings.json` and restart.

## Plan: before building

1. **Research quietly.** Read the code and work out the design. Do not show a written plan.
2. **Sketch.** Draw the system. One sentence under it: what it does for the customer.
3. **Decisions, one at a time**, 3 to 5, only the ones a customer would feel. Skip anything the user wouldn't need to defend. Ask each with AskUserQuestion, pointing at its badge:
   - The question is a **situation**: "Server dies mid-refund (①)."
   - Each option says **what the customer experiences** and what it costs us, no jargon: "Customer is charged, gets no refund, we hear about it from an angry email." Name the tech after the consequence, if at all.
   - Put your recommendation first, marked. The story is what lets the user judge it.
4. **Teach-back.** Ask the user to explain the system in 2 or 3 sentences, including where it fails. "Looks good" is not an answer. If there's a gap, point at the badge and ask about that part only. After two rounds, fill in the gap yourself and move on.
5. **Save the card**, then build as normal. If the build changes a decision, tell the user in one line and update the card.

## Grill: after building

1. **Load the card** for this repo and topic. If there is none, read the code and draw the diagram from it first.
2. **Redraw** the diagram and read the code as it is now. A mismatch with the card is drift: note it for the end.
3. **Ask 4 or 5 questions, one at a time**, as plain messages, not multiple choice: the user answers from memory. Cover the four kinds: why X over Y, malicious actor, data structure and why, where it fails. Point each at a badge or box. Ask about anything that drifted.
4. **Grade each answer** in one line: solid, shaky or wrong, and what the code actually does, with `file:line`. Don't grade names or syntax.
5. **End** with the score, the weak spots, and the drift. Update the card with what changed.
