'use client'
/** GYA only: load the website from the repository into the dashboard. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { useToast } from '../ui/Toast'

export function ImportButtons({ empty }: { empty: boolean }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run(path: string, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    try {
      const r = await api<{ message: string }>(path, { method: 'POST', body: {} })
      toast(r.message, 'good')
      setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      toast((e as Error).message, 'bad')
      setBusy(false)
    }
  }
  return (
    <div className="actions">
      <button className={`btn ${empty ? 'primary' : ''}`} disabled={busy} onClick={() => run('/api/import-content')}>{busy ? 'Working...' : 'Import website content'}</button>
      <button className="btn" disabled={busy} onClick={() => run('/api/import-media')}>Import pictures into the Media Library</button>
      <button className="btn danger" disabled={busy} onClick={() => run('/api/import-content?overwrite=1',
        'Put every page back to how the website was built? Every change made in the dashboard is lost.')}>Reset to the repository&apos;s content</button>
    </div>
  )
}
