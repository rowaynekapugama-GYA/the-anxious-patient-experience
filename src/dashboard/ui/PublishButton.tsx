'use client'
/** Rebuilds the live website from what is saved in the dashboard. */
import React, { useState } from 'react'
import { api } from '../lib/client'
import { useToast } from './Toast'
import { Icon } from './icons'

export function PublishButton({ className = 'btn publish', label = 'Publish website', onDone }: { className?: string; label?: string; onDone?: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      const r = await api<{ message: string }>('/api/publish-site', { method: 'POST', body: {} })
      toast(r.message, 'good')
      onDone?.()
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return <button type="button" className={className} disabled={busy} onClick={go}>{Icon.rocket()} {busy ? 'Publishing...' : label}</button>
}
