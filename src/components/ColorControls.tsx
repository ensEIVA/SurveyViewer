import type { Palette } from '../gen/nexus/v1/nexus_service_pb'
import type { ColorChoice, ColorModes } from '../hooks/useColorModes'
import './ColorControls.css'

interface Props {
  modes: ColorModes
  // Called after Nexus has accepted a new choice.
  onChanged: () => void
}

// Stops are evenly spaced, lowest value first — exactly a CSS linear-gradient.
const gradient = (palette: Palette | undefined) =>
  palette && palette.stops.length > 1
    ? `linear-gradient(to right, ${palette.stops.map(({ r, g, b }) => `rgb(${r} ${g} ${b})`).join(', ')})`
    : undefined

export function ColorControls({ modes, onChanged }: Props) {
  const { attributes, palettes, saving, error, setColorMode } = modes
  // Nexus may not report a current choice yet; fall back to what it offers
  // first, so the pickers still show something sensible.
  const current = modes.current ?? (attributes[0] && palettes[0] ? { attributeName: attributes[0], paletteId: palettes[0].id } : null)
  // Always render the box, so a missing picker is never a mystery.
  if (!current) return <div className="color-controls">Colours: {error ?? 'loading…'}</div>

  const change = async (choice: ColorChoice) => {
    if (await setColorMode(choice)) onChanged()
  }
  const palette = palettes.find(p => p.id === current.paletteId)

  return (
    <div className="color-controls">
      <label>
        Color by{' '}
        <select
          value={current.attributeName}
          disabled={saving}
          onChange={e => change({ ...current, attributeName: e.target.value })}
        >
          {attributes.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Palette{' '}
        <select value={current.paletteId} disabled={saving} onChange={e => change({ ...current, paletteId: e.target.value })}>
          {palettes.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <span className="color-controls-swatch" style={{ background: gradient(palette) }} />
      {error && <span className="color-controls-error">{error}</span>}
    </div>
  )
}
