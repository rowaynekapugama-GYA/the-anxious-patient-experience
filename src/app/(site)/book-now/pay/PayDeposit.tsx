'use client'
/**
 * The deposit on the private pay page. v1.11.0: before paying, the patient agrees to Lorna's deposit policy in the same
 * pop-up as Book Now (/assets/policy.js), unless this booking already agreed to the current version, in which case the
 * page says so. Then the same payment options as Book Now, from /assets/pay.js (cards without a PayPal account, and
 * with PayPal Advanced Checkout switched on, card fields, Apple Pay and Google Pay).
 */
import React, { useEffect, useRef, useState } from 'react'

type Mount = (box: HTMLElement, o: Record<string, unknown>) => Promise<unknown>
type PolicyApi = { open: (o: Record<string, unknown>) => unknown }
declare global { interface Window { APEPay?: { mount: Mount }; APEPolicy?: PolicyApi; apeTrack?: (name: string, params?: Record<string, unknown>) => void } }

const loading: Record<string, Promise<void>> = {}
function load(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve()
  if (!loading[src]) {
    loading[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => (ready() ? resolve() : reject(new Error(`no ${src}`)))
      s.onerror = () => { delete loading[src]; reject(new Error(`${src} failed`)) }
      document.head.appendChild(s)
    })
  }
  return loading[src]
}
const track = (name: string, params: Record<string, unknown> = {}) => { try { window.apeTrack?.(name, params) } catch { /* analytics only */ } }
const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export function PayDeposit({ token, clientId, amount, phone, advanced, env, assetVersion, policy, agreed }: {
  token: string; clientId: string; amount: number; phone: string; advanced: boolean; env: string; assetVersion: string
  policy: { text: string; consentLabel: string; version: string }
  agreed: { at: string; version: string } | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const [ok, setOk] = useState<{ at: string; now: boolean } | null>(agreed ? { at: agreed.at, now: false } : null)
  const [state, setState] = useState<'idle' | 'ready' | 'paid' | 'error' | 'cancelled' | 'busy'>('idle')
  const [detail, setDetail] = useState('')
  const v = encodeURIComponent(assetVersion)

  function openPolicy() {
    load(`/assets/policy.js?v=${v}`, () => !!window.APEPolicy).then(() => {
      window.APEPolicy!.open({
        text: policy.text, consentLabel: policy.consentLabel, version: policy.version, opener: opener.current,
        onAgree: (at: string) => { track('deposit_policy_agreed'); setOk({ at, now: true }) },
      })
    }).catch(() => { setState('error'); setDetail('') })
  }

  useEffect(() => {
    if (!ok || !box.current) return
    let gone = false
    load(`/assets/pay.js?v=${v}`, () => !!window.APEPay).then(() => {
      if (gone || !box.current || !window.APEPay) return
      return window.APEPay.mount(box.current, {
        clientId, token, amount, advanced, env, from: 'pay-page',
        // agreed on this page: saved with the order request; agreed before: nothing new to save
        policyAgreedAt: ok.now ? ok.at : null, policyVersion: ok.now ? policy.version : '',
        onStart: (source: string) => track('deposit_started', { method: source }),
        onPaid: (source: string) => { track('deposit_paid', { value: Number(amount), currency: 'AUD', method: source }); setState('paid') },
        onState: (st: string, msg: string) => { setState(st as typeof state); setDetail(msg || '') },
      })
    }).catch(() => setState('error'))
    return () => { gone = true }
  // mount once, when the policy has been agreed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok])

  if (state === 'paid') return <div className="confirm" role="status"><h3>Thank you, your deposit has been received.</h3><p>A receipt is on its way to your email. The APE team will be in touch to confirm your appointment.</p></div>
  return (
    <div className="pay-box">
      <p className="chosen" style={{ marginTop: 0 }}>Deposit: <strong>${amount}</strong> AUD</p>
      {ok && !ok.now ? <p className="policy-agreed" role="note">You agreed to our deposit policy on {fmt(ok.at)}. <a href="/book-now/terms/" target="_blank" rel="noopener">Read it again<span className="sr-only"> (opens in a new tab)</span></a></p> : null}
      {!ok ? (
        <>
          <p className="q-help">Before paying, please read and agree to our deposit policy.</p>
          <button type="button" className="btn" ref={opener} onClick={openPolicy}>Continue to payment</button>
        </>
      ) : null}
      <div ref={box} className="pay-area" aria-live="polite" hidden={!ok} />
      {state === 'cancelled' ? <p className="q-help" role="status">{detail || 'No payment was taken. You can try again above whenever you are ready; this link stays open for 14 days.'}</p> : null}
      {state === 'error' ? <p className="err" role="alert">{detail || `Sorry, the payment could not be completed. Nothing has been charged. Please try again, or call the clinic on ${phone}.`}</p> : null}
    </div>
  )
}
