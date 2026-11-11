import { useEffect, useState } from 'react'
import type { Theme } from '../types'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Tema efetivo: resolve "sistema" para claro/escuro conforme o aparelho. */
export function resolveTheme(theme: Theme, systemDark = media().matches): 'claro' | 'escuro' {
  if (theme === 'sistema') return systemDark ? 'escuro' : 'claro'
  return theme
}

/**
 * Aplica o tema no <html> e na cor da barra do navegador/app instalado.
 * "sistema" remove o atributo e deixa o CSS seguir prefers-color-scheme.
 */
export function useApplyTheme(theme: Theme) {
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const m = media()
    const onChange = () => setSystemDark(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'sistema') delete root.dataset.theme
    else root.dataset.theme = theme === 'escuro' ? 'dark' : 'light'
    const color = resolveTheme(theme, systemDark) === 'escuro' ? '#0b0b14' : '#f7f6ff'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [theme, systemDark])

  return resolveTheme(theme, systemDark)
}
