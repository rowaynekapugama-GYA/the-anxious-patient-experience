'use client'
/**
 * The deposit on the private pay page. v1.10.0: the patient ticks "I have read the terms and conditions and
 * cancellation policy" first; then the same payment options as inside Book Now, from /assets/pay.js (cards without a
 * PayPal account, and with PayPal Advanced Checkout switched on, card fields, Apple Pay and Google Pay).
 */
import React, { useEffect, useRef, useState } from 'react'

type Mount = (box: HTMLElement, o: Record<string, unknown>) => Promise<unknown>
declare global { interface Window { APEPay?: { mount: Mount } } }

let loading: Promise<void> | null = null
function loadPayJs(v: string): Promise<void> {
  if (window.APEPay) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = `/assets/pay.js?v=${encodeURIComponent(v)}`
      s.async = true
      s.onload = () => (window.APEPay ? resolve() : reject(new Error('no pay.js')))
      s.onerror = () => { loading = null; reject(new Error('pay.js failed')) }
      document.head.appendChild(s)
    })
  }
  return loading
}

export function PayDeposit({ token, clientId, amount, phone, readLabel, advanced, env, assetVersion }: { token: string; clientId: string; amount: number; phone: string; readLabel: string; advanced: boolean; env: string; assetVersion: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(false)
  const [readAt, setReadAt] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [state, setState] = useState<'idle' | 'ready' | 'paid' | 'error' | 'cancelled' | 'busy'>('idle')
  const [detail, setDetail] = useState('')
  useEffect(() => {
    if (!read || !box.current) return
    let gone = false
    loadPayJs(assetVersion).then(() => {
      if (gone || !box.current || !window.APEPay) return
      return window.APEPay.mount(box.current, {
        clientId, token, amount, advanced, env, from: 'pay-page', termsReadAt: readAt,
        onPaid: () => setState('paid'),
        onState: (st: string, msg: string) => { setState(st as typeof state); setDetail(msg || '') },
      })
    }).catch(() => setState('error'))
    return () => { gone = true }
  // mount once, when the box is first ticked
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read])
  if (state === 'paid') return <div className="confirm" role="status"><h3>Thank you, your deposit has been received.</h3><p>A receipt is on its way to your email. The APE team will be in touch to confirm your appointment.</p></div>
  return (
    <div className="pay-box">
      <label className="check">
        <input type="checkbox" id="pay-terms-read" checked={read} disabled={read} aria-invalid={tried && !read ? true : undefined} aria-describedby={tried && !read ? 'pay-terms-read-err' : undefined}
          onChange={(e) => { if (e.target.checked) { setRead(true); setReadAt(new Date().toISOString()) } }} />
        <span>{readLabel}</span>
      </label>
      {!read ? (
        <>
          {tried ? <p className="err" id="pay-terms-read-err" role="alert"><span className="err-mark" aria-hidden="true">!</span> Please tick the box to say you have read the terms and cancellation policy.</p> : null}
          <button type="button" className="btn" onClick={() => setTried(true)}>Continue to payment</button>
        </>
      ) : null}
      <p className="chosen">Deposit: <strong>${amount}</strong> AUD</p>
      <div ref={box} className="pay-area" aria-live="polite" hidden={!read} />
      {state === 'cancelled' ? <p className="q-help" role="status">{detail || 'No payment was taken. You can try again above whenever you are ready; this link stays open for 14 days.'}</p> : null}
      {state === 'error' ? <p className="err" role="alert">{detail || `Sorry, the payment could not be completed. Nothing has been charged. Please try again, or call the clinic on ${phone}.`}</p> : null}
    </div>
  )
}
