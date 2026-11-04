'use client'
/** The WordPress-style frame: dark sidebar, top bar, content area. */
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'
import { BRAND } from '../brand'

type NavItem = { href: string; label: string; icon: keyof typeof Icon; adminOnly?: boolean; count?: number }

export function Shell({ user, children, toConfirm = 0, teamHref = '/admin/pages' }: {
  user: { name?: string; email: string; role: string }
  children: React.ReactNode
  /** booking requests still to confirm */
  toConfirm?: number
  /** the team cards are edited on the homepage itself */
  teamHref?: string
}) {
  const path = usePathname() || '/admin'
  const [open, setOpen] = useState(false)
  const isAdmin = user.role === 'admin'
  const items: (NavItem | 'sep')[] = [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    'sep',
    { href: '/admin/pages', label: 'Pages', icon: 'pages' },
    { href: '/admin/posts', label: 'Blog Posts', icon: 'posts' },
    { href: '/admin/media', label: 'Media Library', icon: 'media' },
    { href: teamHref, label: 'Team', icon: 'team' },
    { href: '/admin/bookings', label: 'Bookings', icon: 'bookings', count: toConfirm },
    { href: '/admin/availability', label: 'Availability', icon: 'availability' },
    { href: '/admin/special', label: 'Opening special', icon: 'special' },
    'sep',
    { href: '/admin/seo', label: 'SEO', icon: 'seo' },
    { href: '/admin/settings', label: 'Site Settings', icon: 'settings' },
    { href: '/admin/redirects', label: 'Redirects', icon: 'redirects', adminOnly: true },
    { href: '/admin/users', label: 'Users', icon: 'users', adminOnly: true },
  ]
  const on = (href: string) => (href === '/admin' ? path === '/admin' || path === '/admin/'
    : href === teamHref ? false
      : path.startsWith(href))
  const initials = (user.name || user.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    window.location.href = '/admin/login'
  }

  return (
    <>
      <aside className={`pd-side${open ? ' open' : ''}`} aria-label="Dashboard menu" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false) }}>
        <div className="brand"><img src={BRAND.logoOnDark} alt={BRAND.name} /></div>
        <ul className="pd-nav">
          {items.filter((i) => i === 'sep' || !i.adminOnly || isAdmin).map((i, n) => i === 'sep'
            ? <li key={`s${n}`} className="sep" aria-hidden="true" />
            : (
              <li key={i.href}>
                <Link href={i.href} className={on(i.href) ? 'on' : ''} aria-current={on(i.href) ? 'page' : undefined}>
                  {Icon[i.icon]()}<span>{i.label}</span>
                  {i.count ? <span className="count" title={`${i.count} to confirm`}>{i.count}</span> : null}
                </Link>
              </li>
            ))}
        </ul>
        <div className="foot">Website dashboard by GYA</div>
      </aside>
      <header className="pd-top">
        <button className="menu-btn" aria-label="Open the menu" onClick={() => setOpen((o) => !o)}>{Icon.menu()}</button>
        <Link className="site" href="/admin">{BRAND.name}</Link>
        <a className="view" href="/" target="_blank" rel="noopener" aria-label="View the website">{Icon.external()} <span className="view-label">View site</span></a>
        <span className="spacer" />
        <span className="who">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <span className="name"><b>{user.name || user.email}</b> {isAdmin ? '(GYA)' : ''}</span>
          <button className="logout" onClick={logout}>Log out</button>
        </span>
      </header>
      <main className="pd-main"><div className="pd-wrap">{children}</div></main>
    </>
  )
}
