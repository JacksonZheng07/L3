/**
 * L3 Design Tokens — single source of truth for all colors, shadows, and constants.
 * Import from here instead of scattering hex strings across components.
 */

export const GRADE_COLOR = {
  safe: '#3fb950',
  warning: '#d29922',
  critical: '#f85149',
} as const;

export const GRADE_BG_CLASS = {
  safe: 'bg-[#3fb950]/10',
  warning: 'bg-[#d29922]/10',
  critical: 'bg-[#f85149]/10',
} as const;

export const COLORS = {
  sidebar: '#0d1117',
  mainBg: '#0a0d12',
  cardBg: '#161b22',
  cardBgDark: '#0d1117',
  hover: '#21262d',
  border: '#30363d',
  borderSoft: '#21262d',
  text: {
    primary: '#c9d1d9',
    secondary: '#8b949e',
  },
  accent: {
    blue: '#58a6ff',
    green: '#3fb950',
    yellow: '#d29922',
    red: '#f85149',
    purple: '#a855f7',
  },
  source: {
    allium: '#58a6ff',
    direct: '#d29922',
  },
  grade: GRADE_COLOR,
} as const;

export const SHADOWS = {
  card: '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
  cardHover: '0 4px 20px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)',
  sidebar: '2px 0 8px rgba(0,0,0,0.4)',
} as const;

/** Returns the hex color for a trust grade */
export function gradeColor(grade: 'safe' | 'warning' | 'critical'): string {
  return GRADE_COLOR[grade];
}

/** Returns the Tailwind bg class for a trust grade */
export function gradeBg(grade: 'safe' | 'warning' | 'critical'): string {
  return GRADE_BG_CLASS[grade];
}
