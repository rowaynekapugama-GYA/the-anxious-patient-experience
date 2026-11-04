import { BRAND } from '../brand'

/** Dates as the practice reads them. Safe on the server and in the browser. */
export function when(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: BRAND.timeZone, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
