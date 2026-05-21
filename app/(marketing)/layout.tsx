// Marketing pages are self-contained — no shared HeaderNav wrapper
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
