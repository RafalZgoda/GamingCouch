import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '2rem', padding: '2rem' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800 }}>🎮 GamingCouch</h1>
      <p style={{ color: 'var(--accent-light)', fontSize: '1.25rem' }}>Party gaming on your couch. Phone as controller.</p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/host" style={{ padding: '1rem 2rem', background: 'var(--accent)', color: '#fff', borderRadius: '0.75rem', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          Host a Game
        </Link>
        <Link href="/join" style={{ padding: '1rem 2rem', background: 'transparent', color: 'var(--accent-light)', border: '2px solid var(--accent-light)', borderRadius: '0.75rem', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          Join with Phone
        </Link>
      </div>
    </main>
  );
}
