import Link from 'next/link'

export default function Nav({ active }: { active: 'home' | 'seats' | 'rooms' }) {
  return (
    <nav className="nav">
      <Link href="/" className={active === 'home' ? 'active' : ''}>
        <span className="nav-icon">👁</span>
        Nearby
      </Link>
      <Link href="/seats" className={active === 'seats' ? 'active' : ''}>
        <span className="nav-icon">☕</span>
        Seats
      </Link>
      <Link href="/rooms" className={active === 'rooms' ? 'active' : ''}>
        <span className="nav-icon">🃏</span>
        Rooms
      </Link>
    </nav>
  )
}
