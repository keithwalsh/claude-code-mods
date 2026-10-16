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

// An assistant message calling the Skill tool, as $.session.messages() returns it.
const skillCall = (skill: string, id: string, isError?: true) => ({
  role: 'assistant' as const,
  text: '',
  toolUses: [{ tool_use_id: id, tool: 'Skill', input: { skill }, ...(isError && { isError }) }],
})

// The engine expanding a skill's prompt: hands the text back as it came.
const expandSkills = (on: On) => on('skill.prompt', async (_$, e) => ({ text: e.text }))

// What i-have-adhd's SessionStart hook hands the model, cut short.
const ADHD = 'ADHD MODE ACTIVE (always-on). Say "stop adhd mode" to turn it off.\n\n\r\n# i-have-adhd\r\n\r\nThe reader has ADHD.'

type ApiMessage = { role: 'user' | 'assistant'; content: { type: string; text?: string }[] }

// Stands in for the engine beneath the mod at session start: `rows` is the
// transcript as rows, `api` the model's copy of it.
function fakeSession(on: On, rows: ReturnType<typeof skillCall>[], api: ApiMessage[] = []) {
  expandSkills(on)
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.messages', async (_$, e) => ({ value: e?.as === 'api' ? api : rows }))
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
  fakeSession(on, [skillCall('plugin-authoring', 't1'), skillCall('nope', 't2', true), skillCall('plugin-authoring', 't3')])
  await $.session.start(start)
  await $.skill.prompt({ skill: 'pdf', text: '' })

  const texts = await listed($, 'desktop')
  expect(texts.slice(0, 2)).toEqual(['plugin-authoring', 'pdf'])
  expect(texts).not.toContain('nope')
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
  fakeSession(on, [], [{ role: 'user', content: [{ type: 'text', text: reminder }, { type: 'text', text: 'hello' }] }])
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
