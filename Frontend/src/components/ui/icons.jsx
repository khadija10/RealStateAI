// Jeu d'icônes unique de l'application : trait de 1,6 px, coins arrondis,
// grille 24 × 24. Toutes décoratives par défaut (aria-hidden).

function Icon({ size = 18, className, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconEstimate = (p) => (
  <Icon {...p}><path d="M4 20V10l8-6 8 6v10" /><path d="M9.5 20v-5.5h5V20" /></Icon>
)
export const IconWallet = (p) => (
  <Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M16 12.5h2.5" /><path d="M3 9.5h18" /></Icon>
)
export const IconTrend = (p) => (
  <Icon {...p}><path d="M4 17l5.5-5.5 3.5 3.5L20 8" /><path d="M14.5 8H20v5.5" /></Icon>
)
export const IconMap = (p) => (
  <Icon {...p}><path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" /><path d="M9 4.5v13M15 6.5v13" /></Icon>
)
export const IconChart = (p) => (
  <Icon {...p}><path d="M4 20h16" /><path d="M7 16v-4M12 16V8M17 16v-7" /></Icon>
)
export const IconHistory = (p) => (
  <Icon {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4.5V8h3.5" /><path d="M12 8v4.5l3 1.8" /></Icon>
)
export const IconUser = (p) => (
  <Icon {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></Icon>
)
export const IconLogout = (p) => (
  <Icon {...p}><path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" /><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" /></Icon>
)
export const IconSun = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="3.8" /><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M18.4 5.6l-1.3 1.3M6.9 17.1l-1.3 1.3" /></Icon>
)
export const IconMoon = (p) => (
  <Icon {...p}><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" /></Icon>
)
export const IconChevronDown = (p) => (
  <Icon {...p}><path d="M6 9.5l6 6 6-6" /></Icon>
)
export const IconChevronRight = (p) => (
  <Icon {...p}><path d="M9.5 6l6 6-6 6" /></Icon>
)
export const IconArrowRight = (p) => (
  <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
)
export const IconCheck = (p) => (
  <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>
)
export const IconPlus = (p) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
)
export const IconClose = (p) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
)
export const IconAlert = (p) => (
  <Icon {...p}><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5" /><path d="M12 17.2v.1" /></Icon>
)
export const IconInfo = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8v.1" /></Icon>
)
export const IconLock = (p) => (
  <Icon {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Icon>
)
export const IconRefresh = (p) => (
  <Icon {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5V8H16" /></Icon>
)
export const IconSearch = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Icon>
)
export const IconCompass = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Icon>
)
export const IconMenu = (p) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
)
