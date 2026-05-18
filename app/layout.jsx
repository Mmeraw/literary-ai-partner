// app/layout.jsx
import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'RevisionGrade',
  description: 'PhD-calibrated literary evaluation and revision tools for serious writers',
}

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/evaluate', label: 'Evaluate' },
  { href: '/revise', label: 'Revise' },
  { href: '/resources', label: 'Resources' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/login', label: 'Sign In' },
]

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-shell">
            <div className="site-header-inner">
              <Link href="/" className="brand-mark">
                RevisionGrade
              </Link>

              <nav className="site-nav" aria-label="Primary">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="site-nav-link">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  )
}