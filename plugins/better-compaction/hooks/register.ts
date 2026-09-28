import type { Register, TurnStepInput } from 'claude-code'

export const register: Register = (on, options) => {
  const defer = options.deferCompaction !== false
  // Never defer once the context is this full (% of the model's window): past it,
  // waiting risks a prompt-too-long error, so the compaction runs mid-turn.
  const deferUnderPercent = typeof options.deferUnderPercent === 'number' ? options.deferUnderPercent : 80
  const effort = typeof options.compactionEffort === 'string' ? options.compactionEffort : 'inherit'
  const overrideEffort = effort !== 'inherit'

  let midTurn = false // the main loop has sent a request this turn
  let lastStepFailed = false // the main loop's last request got no response (e.g. prompt too long)
  let pending = false // an auto-compaction was deferred this turn
  let saved: { value: string | undefined } | undefined // CLAUDE_CODE_EFFORT_LEVEL before the override
  let turnEffort: TurnStepInput['effort'] // the conversation's own effort, last seen
  // Each running subagent's own effort, from its steps outside a summary.
  // ponytail: a subagent whose first step falls inside a summary gets the
  // conversation's effort, which is wrong only if its definition sets another.
  const agentEffort = new Map<string, TurnStepInput['effort']>()

  // Every compaction path (threshold, prompt-too-long, /compact, a plugin's)
  // runs the classic PreCompact hooks right before its summarizer request.
  on('classic.PreCompact', async ($, e, next) => {
    if (e.agent_id) return next(e) // a subagent's own transcript: leave it alone

    if (defer && e.trigger === 'auto' && midTurn && !lastStepFailed) {
      const { context } = await $.session.usage()
      if ((context.percent ?? 0) < deferUnderPercent) {
        pending = true
        return { block: 'better-compaction: compacting when this turn ends' }
      }
    }

    // The summarizer reads effort when it builds its request; the env var
    // outranks the session's setting. Same model, so the cache still hits.
    // It is process-wide; turn.step hands subagents their own effort back.
    if (overrideEffort && !saved) {
      saved = { value: await $.env.get('CLAUDE_CODE_EFFORT_LEVEL') }
      await $.env.set('CLAUDE_CODE_EFFORT_LEVEL', effort)
    }
    return next(e)
  })

  on('classic.PostCompact', async ($, e, next) => {
    if (saved && !e.agent_id) {
      await $.env.set('CLAUDE_CODE_EFFORT_LEVEL', saved.value)
      saved = undefined
    }
    return next(e)
  })

  // A precomputed summary is made in the background while the turn runs, where
  // the effort override would leak into the turn's own requests. Skip it; the
  // summary is then made when compaction happens, at the chosen effort.
  on('session.compact', ($, e, next) => {
    if (overrideEffort && e.trigger === 'precompute') {
      return { skip: 'better-compaction: summaries run at their own effort, not ahead of time' }
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      // A subagent stepping while a summary runs would read the override too;
      // a step's own effort outranks the env var, so give it back its own.
      if (!saved) agentEffort.set(e.agentId, e.effort)
      else e = { ...e, effort: agentEffort.has(e.agentId) ? agentEffort.get(e.agentId) : turnEffort }
      return yield* next(e)
    }
    if (saved) {
      // A compaction ended without PostCompact (it failed, or another hook
      // blocked it): put the effort back before this request goes out.
      await $.env.set('CLAUDE_CODE_EFFORT_LEVEL', saved.value)
      saved = undefined
      if (turnEffort !== undefined) e = { ...e, effort: turnEffort }
    }
    turnEffort = e.effort
    midTurn = true
    const r = yield* next(e)
    lastStepFailed = r.stopReason === null
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) {
      agentEffort.delete(e.agentId)
      return r
    }
    midTurn = false
    lastStepFailed = false
    if (pending) {
      pending = false
      // $.session.compact refuses while the turn is still held; this hook
      // returning releases it. Compacting now, not at the next prompt, keeps
      // the prompt cache warm. Where it's refused (headless -p / SDK), the
      // next prompt's own auto-compaction check picks it up instead.
      $.clock.after(0, () => {
        $.session.compact().catch((err) =>
          $.ui.log(`better-compaction: deferred compaction left to the next prompt: ${err}`, { to: 'debug' }),
        )
      })
    }
    return r
  })
}
