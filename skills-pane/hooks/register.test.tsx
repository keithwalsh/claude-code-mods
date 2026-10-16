import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PANE = {
  plugin: 'skills-pane',
  component: 'Pane',
  requestId: 'skills',
  props: {
    title: 'Skills',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'skills-pane',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 5,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

type ApiMessage = { role: 'user' | 'assistant'; content: { type: string; [field: string]: unknown }[] }

// A Skill tool call and its result, as $.session.messages({ as: 'api' }) returns them.
const skillCall = (skill: string, id: string, isError?: true): ApiMessage[] => [
  { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Skill', input: { skill } }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Launching skill', ...(isError && { is_error: true }) }] },
]

// A user message of plain text blocks.
const said = (...texts: string[]): ApiMessage => ({ role: 'user', content: texts.map(text => ({ type: 'text', text })) })

// The engine expanding a skill's prompt: hands the text back as it came.
const expandSkills = (on: On) => on('skill.prompt', async (_$, e) => ({ text: e.text }))

// What i-have-adhd's SessionStart hook hands the model, cut short.
const ADHD = 'ADHD MODE ACTIVE (always-on). Say "stop adhd mode" to turn it off.\n\n\r\n# i-have-adhd\r\n\r\nThe reader has ADHD.'

// Stands in for the engine beneath the mod at session start: `api` is the model's
// copy of the conversation so far.
function fakeSession(on: On, api: ApiMessage[]) {
  expandSkills(on)
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.messages', async () => ({ value: api }))
  on('command.register', async () => ({ value: { command: 'skills' } }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
}

const start = { cwd: 'C:/code', surface: null, isInteractive: true }

async function listed($: Engine, surface: 'terminal' | 'desktop') {
  const ui = await $.ui.mount({ ...PANE, surface })

  return (await ui.findAll({ type: 'Text' })).map(t => t.text)
}

test('lists each skill once, in the order first loaded', async ($, on) => {
  expandSkills(on)
  for (const skill of ['pdf', 'xlsx', 'pdf'])
    await $.skill.prompt({ skill, text: '' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const texts = await listed($, surface)
    expect(texts.slice(0, 2)).toEqual(['pdf', 'xlsx'])
    expect(texts.filter(t => t === 'pdf')).toHaveLength(1)
  }
})

test('says so when no skill has loaded', async $ => {
  for (const surface of ['terminal', 'desktop'] as const)
    expect(await listed($, surface)).toContain('No skills loaded yet.')
})

test('picks up skills the Skill tool loaded before the mod, skipping failed calls', async ($, on) => {
  fakeSession(on, [...skillCall('plugin-authoring', 't1'), ...skillCall('nope', 't2', true), ...skillCall('plugin-authoring', 't3')])
  await $.session.start(start)
  await $.skill.prompt({ skill: 'pdf', text: '' })

  const texts = await listed($, 'desktop')
  expect(texts.slice(0, 2)).toEqual(['plugin-authoring', 'pdf'])
  expect(texts).not.toContain('nope')
})

// What the engine's copy of the conversation holds for each, as measured on 2.1.295.
const TYPED = "<command-message>afriport-report</command-message>\n<command-name>/afriport-report</command-name>\n<command-args>what's next?</command-args>"
const HARNESS = '<command-message>workflow-authoring</command-message>\n<command-name>workflow-authoring</command-name>\n<skill-format>true</skill-format>'
const BUILT_IN = '<command-name>/compact</command-name>\n            <command-message>compact</command-message>\n            <command-args></command-args>'
const KEPT = 'The following skills were invoked EARLIER in this session (before the conversation was compacted), not on the current turn.\n\n### Skill: skill-improver\nPath: userSettings:skill-improver\n\nBase directory for this skill: C:/skills/skill-improver'

test('rebuilds the list after an engine restart: typed as /name, loaded by the harness or kept by a compaction', async ($, on) => {
  fakeSession(on, [said(KEPT), said(TYPED), said(BUILT_IN), ...skillCall('halo', 't1'), said(HARNESS)])
  await $.session.start(start)

  const texts = await listed($, 'desktop')
  expect(texts.slice(0, 4)).toEqual(['skill-improver', 'afriport-report', 'halo', 'workflow-authoring'])
  expect(texts).not.toContain('compact')
  expect(texts).not.toContain('No skills loaded yet.')
})

test('lists context SessionStart hooks inject, named by its heading or else its first line', async ($, on) => {
  on('classic.SessionStart', async () => ({ additionalContext: [ADHD, 'Branch main is 3 commits ahead.'] }))
  await $.classic.SessionStart({ source: 'startup' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const texts = await listed($, surface)
    expect(texts).toContain('Injected at session start')
    expect(texts).toContain('i-have-adhd')
    expect(texts).toContain('Branch main is 3 commits ahead.')
  }
})

test("picks up context injected before the mod loaded, from the model's copy of the conversation", async ($, on) => {
  const reminder = `<system-reminder>SessionStart:startup hook success: ${ADHD}</system-reminder>`
  fakeSession(on, [said(reminder, 'hello')])
  await $.session.start(start)

  const texts = await listed($, 'desktop')
  expect(texts).toContain('i-have-adhd')
  expect(texts).not.toContain('hello')
})

test('a click on the toggle closes and reopens the pane, lit while open and dimmed while closed', async ($, on) => {
  const calls: string[] = []
  on('ui.open', async (_$, e) => {
    calls.push(`open ${e.id}`)

    return { value: { isPlaced: true } }
  })
  on('ui.close', async (_$, e) => {
    calls.push(`close ${e.id}`)

    return { value: undefined }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    const label = async () => (await band.find({ type: 'Text', text: 'Skills', in: 'toggle-skills' }))?.props
    const click = async () => {
      await band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'toggle-skills' })
      await band.pointer({ type: 'up', x: 1, y: 0, button: 'left', in: 'toggle-skills' })
    }
    expect((await label())?.color).toBe('#3A9AEC')

    await click()
    expect(calls.at(-1)).toBe('close skills')
    expect((await label())?.color).toBeUndefined()
    expect((await label())?.dimColor).toBe(true)

    await click()
    expect(calls.at(-1)).toBe('open skills')
    expect((await label())?.color).toBe('#3A9AEC')
  }
})

test('keeps the toggle while the engine shows a survey, drawing the survey above it', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>How is Claude doing this session?</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
    expect(await band.find({ type: 'Text', text: /How is Claude doing/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: 'Skills', in: 'toggle-skills' })).toBeDefined()
  }
})
