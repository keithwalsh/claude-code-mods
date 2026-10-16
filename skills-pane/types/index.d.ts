// Skill names in the order they were first loaded this session.
export type Skills = string[]

// Labels of the context SessionStart hooks injected, in the order first seen.
export type Injected = string[]

declare module 'claude-code' {
  interface PluginState {
    // isClosed: the pane was closed, so the band's toggle draws dimmed and reopens it.
    'skills-pane': { skills: Skills; injected: Injected; isClosed: boolean }
  }
}
