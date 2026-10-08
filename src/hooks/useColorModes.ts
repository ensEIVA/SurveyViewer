import { useCallback, useEffect, useState } from 'react'
import type { Palette } from '../gen/nexus/v1/nexus_service_pb'
import { nexusClient } from '../services/nexusClient'

export interface ColorChoice {
  attributeName: string
  paletteId: string
}

export interface ColorModes {
  attributes: string[]
  palettes: Palette[]
  current: ColorChoice | null
  // A SetColorMode call is in flight.
  saving: boolean
  error: string | null
  // Resolves true once Nexus has accepted the choice.
  setColorMode: (choice: ColorChoice) => Promise<boolean>
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

// What Nexus offers to colour by, and the current (shared, server-owned)
// choice. Asked once on mount: another frontend changing the choice isn't
// picked up until reload.
export function useColorModes(): ColorModes {
  const [attributes, setAttributes] = useState<string[]>([])
  const [palettes, setPalettes] = useState<Palette[]>([])
  const [current, setCurrent] = useState<ColorChoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cancelled flag rather than aborting: see useLivePoints.
    let cancelled = false
    nexusClient
      .getColorModes({})
      .then(res => {
        if (cancelled) return
        setAttributes(res.attributes)
        setPalettes(res.palettes)
        if (res.current) setCurrent({ attributeName: res.current.attributeName, paletteId: res.current.paletteId })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('[viewer] GetColorModes failed', err)
        setError(message(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setColorMode = useCallback(async (choice: ColorChoice) => {
    setSaving(true)
    setError(null)
    try {
      const res = await nexusClient.setColorMode({ colorMode: choice })
      // The mode Nexus says is now in effect, not just what we asked for.
      if (res.colorMode) setCurrent({ attributeName: res.colorMode.attributeName, paletteId: res.colorMode.paletteId })
      return true
    } catch (err) {
      console.error('[viewer] SetColorMode failed', err)
      setError(message(err))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { attributes, palettes, current, saving, error, setColorMode }
}
