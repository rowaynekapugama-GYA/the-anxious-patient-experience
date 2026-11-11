'use client'
/** The PayPal buttons on the private pay page. The same flow as inside Book Now (public/assets/site.js). */
import React, { useEffect, useRef, useState } from 'react'

declare global { interface Window { paypal?: any; APE_PAYPAL_SDK?: string } }

export function PayDeposit({ token, clientId, amount, phone }: { token: string; clientId: string; amount: number; phone: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'paid' | 'error' | 'cancelled'>('loading')
  const [detail, setDetail] = useState('')
  useEffect(() => {
    let cancelled = false
    const render = () => {
      if (cancelled || !window.paypal || !box.current) return
      box.current.innerHTML = ''
      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay' },
        createOrder: async () => {
          const r = await fetch('/api/paypal/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || !j.id) throw new Error(j.error || 'order')
          return j.id
        },
        onApprove: async (data: { orderID: string }) => {
          const r = await fetch('/api/paypal/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, orderId: data.orderID }) })
          const j = await r.json().catch(() => ({}))
          if (r.ok && j.ok) { setState('paid'); return }
          setDetail(j.error || ''); setState('error')
        },
        onCancel: () => setState('cancelled'),
        onError: () => setState('error'),
      }).render(box.current).then(() => setState('ready')).catch(() => setState('error'))
    }
    if (window.paypal) { render(); return }
    const s = document.createElement('script')
    s.src = `${window.APE_PAYPAL_SDK || 'https://www.paypal.com/sdk/js'}?client-id=${encodeURIComponent(clientId)}&currency=AUD&intent=capture&enable-funding=card&disable-funding=paylater,venmo&components=buttons&locale=en_AU`
    s.async = true; s.onload = render; s.onerror = () => setState('error')
    document.head.appendChild(s)
    return () => { cancelled = true }
  }, [token, clientId])
  if (state === 'paid') return <div className="confirm" role="status"><h3>Thank you, your deposit has been received.</h3><p>A receipt is on its way to your email. The APE team will be in touch to confirm your appointment.</p></div>
  return (
    <div className="pay-box">
      <p className="chosen" style={{ marginTop: 0 }}>Deposit: <strong>${amount}</strong> AUD</p>
      <div ref={box} className="paypal-buttons" aria-live="polite" />
      {state === 'loading' ? <p className="q-help">Loading secure payment options</p> : null}
      {state === 'cancelled' ? <p className="q-help" role="status">No payment was taken. You can try again above whenever you are ready; this link stays open for 14 days.</p> : null}
      {state === 'error' ? <p className="err" role="alert">Sorry, the payment could not be completed{detail ? ` (${detail.replace(/_/g, ' ')})` : ''}. Nothing has been charged. Please try again, or call the clinic on {phone}.</p> : null}
    </div>
  )
}
