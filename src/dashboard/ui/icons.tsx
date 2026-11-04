/** Line icons for the dashboard (24px grid, stroke = currentColor). */
import React from 'react'

const S = (p: { children: React.ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p.children}</svg>
)

export const Icon = {
  dashboard: () => <S><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></S>,
  pages: () => <S><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></S>,
  posts: () => <S><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></S>,
  media: () => <S><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></S>,
  team: () => <S><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17.5" cy="9" r="2.4" /><path d="M16 14.6c2.8.2 5 2.1 5 4.9" /></S>,
  bookings: () => <S><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" /><path d="m9.5 14.5 2 2 3.5-3.8" /></S>,
  availability: () => <S><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></S>,
  special: () => <S><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.4" /></S>,
  enquiries: () => <S><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></S>,
  seo: () => <S><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /><path d="M8.5 11h5M11 8.5v5" /></S>,
  settings: () => <S><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>,
  beforeAfter: () => <S><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /><path d="m6 14 2-2 2 2M14 15l2-3 2 3" /></S>,
  redirects: () => <S><path d="M4 7h11l-3-3M20 17H9l3 3" /></S>,
  users: () => <S><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></S>,
  external: () => <S size={16}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></S>,
  grip: () => <S size={18}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></S>,
  chevron: () => <S size={18}><path d="m6 9 6 6 6-6" /></S>,
  upload: () => <S size={16}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></S>,
  image: () => <S size={16}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></S>,
  eye: () => <S size={16}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></S>,
  eyeOff: () => <S size={16}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1" /></S>,
  info: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></S>,
  warn: () => <S><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></S>,
  check: () => <S><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></S>,
  plus: () => <S size={16}><path d="M12 5v14M5 12h14" /></S>,
  trash: () => <S size={16}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></S>,
  rocket: () => <S size={16}><path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2" /><path d="M9 15 6 12c1-3 4-9 13-9 0 9-6 12-9 13z" /><circle cx="15" cy="9" r="1.5" /></S>,
  menu: () => <S><path d="M4 7h16M4 12h16M4 17h16" /></S>,
  arrowUp: () => <S size={16}><path d="M12 19V5M6 11l6-6 6 6" /></S>,
  arrowDown: () => <S size={16}><path d="M12 5v14M6 13l6 6 6-6" /></S>,
  download: () => <S size={16}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></S>,
}
