import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'skills'
const TITLE = 'Skills'
const skills = atom({ plugin: 'skills-pane', key: 'skills' } as const, [])
const injected = atom({ plugin: 'skills-pane', key: 'injected' } as const, [])
const isClosed = atom({ plugin: 'skills-pane', key: 'isClosed' } as const, false)

async function openPane($: EngineInterface) {
  const opened = await $.ui.open({ id: PANE, title: TITLE }).catch((error: unknown) => ({
    isPlaced: false as const,
    reason: error instanceof Error ? error.message : String(error),
  }))
  if (opened.isPlaced) await update($, isClosed, () => false)

  return opened
}

// The mod's own close does not pass through its own ui.close hook, so it sets the flag here.
async function closePane($: EngineInterface) {
  await $.ui.close({ id: PANE })
  await update($, isClosed, () => true)
}

// Each adds the names not listed yet, keeping first-seen order.
const addSkills = ($: EngineInterface, names: string[]) =>
  update($, skills, seen => [...new Set([...seen, ...names])])
const addInjected = ($: EngineInterface, names: string[]) =>
  update($, injected, seen => [...new Set([...seen, ...names.filter(Boolean)])])

// Names a SessionStart hook's context by its first "# heading", else its first line.
function label(context: string) {
  const heading = /^#\s+(.+?)\s*$/m.exec(context)?.[1]
  const first = context.trim().split(/\r?\n/)[0] ?? ''

  return heading ?? (first.length > 60 ? `${first.slice(0, 57)}...` : first)
}

// A skill typed as /name leaves "<command-message>name</command-message>" then
// "<command-name>/name</command-name>"; a built-in such as /compact puts <command-name>
// first. One loaded before a compaction comes back as "### Skill: name" over "Path: ...".
const TYPED_SKILL = /<command-message>[^<]*<\/command-message>\s*<command-name>\/?([^<]+)<\/command-name>/g
const KEPT_SKILL = /^### Skill: (.+?)\r?\nPath: /gm

// Skills loaded before this module was loaded, from the model's copy of the conversation
// (the rows form leaves out what a compaction kept): Skill tool calls that did not fail,
// skills typed as /name, and skills a compaction kept. The desktop restarts an idle
// session's engine, which empties the list, so this is what rebuilds it.
async function loadedSoFar($: EngineInterface) {
  const messages = await $.session.messages({ as: 'api' })
  const failed = new Set<unknown>()
  for (const message of messages)
    for (const block of message.content)
      if (block.type === 'tool_result' && block.is_error) failed.add(block.tool_use_id)

  const names: string[] = []
  for (const message of messages)
    for (const block of message.content) {
      const input = block.input as { skill?: unknown } | undefined
      if (block.type === 'tool_use' && block.name === 'Skill' && !failed.has(block.id) && typeof input?.skill === 'string')
        names.push(input.skill)
      if (message.role === 'user' && block.type === 'text' && typeof block.text === 'string')
        for (const match of [...block.text.matchAll(TYPED_SKILL), ...block.text.matchAll(KEPT_SKILL)])
          names.push(match[1] ?? '')
    }

  return names.filter(Boolean)
}

// Context SessionStart hooks injected before this module was loaded. The model's
// copy of the conversation carries each as "SessionStart:<source> hook success: <text>".
const HOOK_CONTEXT = /SessionStart:\w+ hook success: ([\s\S]*?)(?=<\/system-reminder>|SessionStart:\w+ hook success: |$)/g

async function injectedSoFar($: EngineInterface) {
  const labels: string[] = []
  for (const message of await $.session.messages({ as: 'api' }))
    if (message.role === 'user')
      for (const block of message.content)
        if (block.type === 'text' && typeof block.text === 'string')
          for (const match of block.text.matchAll(HOOK_CONTEXT))
            labels.push(label(match[1] ?? ''))

  return labels
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // Not "skills": the desktop app answers /skills itself, with its Skills settings page.
    await $.command.register({ name: 'skills-pane', description: 'Show the skills loaded in this session' })
    await addSkills($, await loadedSoFar($))
    await addInjected($, await injectedSoFar($))
    void openPane($)

    return started
  })

  // The desktop app attaches after the session starts; open again so it seats the pane.
  on('session.attach', async ($, e, next) => {
    const attached = await next(e)
    void openPane($)

    return attached
  })

  // Every skill load: typed as /name, called through the Skill tool, or preloaded into a subagent.
  on('skill.prompt', async ($, e, next) => {
    await addSkills($, [e.skill])

    return next(e)
  })

  // The settings and plugin hooks run beneath this one; their context comes back one entry per hook.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    await addInjected($, (result.additionalContext ?? []).map(label))

    return result
  })

  // Closed by the person's X, the band's toggle or another plugin; an unload is not a close.
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE && e.origin.kind !== 'unload') await update($, isClosed, () => true)

    return closed
  })

  // A toggle for the pane above the prompt, drawn by ./toggle.tsx: lit while open,
  // dimmed while closed. A desktop Button takes no colours, so it is a Client where
  // the surface has them, and a plain Button elsewhere (VS Code, mobile). While the
  // engine shows a survey here, its band is drawn above the toggle, not replaced.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const isOpen = !(await read($, isClosed))
    const survey = e.props.hasSurvey ? await next(e) : undefined
    if (e.surface === 'terminal' || e.surface === 'desktop') {
      const { Box, Client } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          {survey}
          <Box>
            <Client key="toggle-skills" module="./toggle.tsx" props={{ isOpen }} />
          </Box>
        </Box>
      )
    }
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {survey}
        <Box>
          <Button
            key="toggle-skills"
            label="Skills"
            dimColor={!isOpen}
            onPress={() => (isOpen ? closePane($) : openPane($))}
          />
        </Box>
      </Box>
    )
  })

  // The toggle was clicked.
  on('ui.message', async ($, e, next) => {
    if (e.element !== 'toggle-skills') return next(e)
    if (await read($, isClosed)) await openPane($)
    else await closePane($)

    return {}
  })

  on('command.run', { command: 'skills-pane' }, async $ => {
    const opened = await openPane($)

    return { text: opened.isPlaced ? 'Skills pane opened.' : `Skills pane not placed: ${opened.reason}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const loaded = await read($, skills)
    const atStart = await read($, injected)

    return (
      <Box flexDirection="column">
        {loaded.length === 0 && <Text dimColor>No skills loaded yet.</Text>}
        {loaded.map(name => (
          <Text>{name}</Text>
        ))}
        {atStart.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Injected at session start</Text>
            {atStart.map(name => (
              <Text>{name}</Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
