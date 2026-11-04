import type { Metadata } from 'next'
import '@/dashboard/dashboard.css'
import { ToastProvider } from '@/dashboard/ui/Toast'
import { BRAND } from '@/dashboard/brand'

export const metadata: Metadata = {
  title: { default: `Dashboard | ${BRAND.name}`, template: `%s | ${BRAND.name} dashboard` },
  robots: { index: false, follow: false },
  icons: { icon: BRAND.favicon },
}

export default function DashboardRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="pd"><ToastProvider>{children}</ToastProvider></body>
    </html>
  )
}
