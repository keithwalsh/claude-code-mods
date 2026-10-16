import type { ClientModule } from 'claude-code'

// The Skills toggle above the prompt, drawn by hand because a desktop Button takes
// no colours: lit in the blue the title bar uses for an open panel (sampled from the
// dark theme's Files icon), dimmed while the pane is closed. A click posts { toggle }.
const ACTIVE = '#3A9AEC'
const ACTIVE_BG = '#032042'
const HOVER_BG = '#2C2C2C'

type Props = { isOpen: boolean }
type State = { isHovered: boolean }

const Toggle: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const isHovered = surface.state?.isHovered ?? false
  // Unmeasured (0 x 0) counts as inside; measured, a release off the toggle cancels.
  const isInside = (x: number, y: number) =>
    surface.columns === 0 || (x >= 0 && y >= 0 && x < surface.columns && y < surface.rows)

  // The instance holds the pointer from a press in its region to the release.
  surface.onPointer(event => {
    if (event.type === 'enter') surface.setState({ isHovered: true })
    if (event.type === 'leave') surface.setState({ isHovered: false })
    if (event.type === 'up' && event.button === 'left' && isInside(event.x, event.y)) surface.post({ toggle: true })
  })

  return (
    <Box paddingX={1} backgroundColor={props.isOpen ? ACTIVE_BG : isHovered ? HOVER_BG : undefined}>
      <Text color={props.isOpen ? ACTIVE : undefined} dimColor={!props.isOpen && !isHovered}>
        Skills
      </Text>
    </Box>
  )
}

export default Toggle
