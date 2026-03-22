import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <style>{`
        .home-bg {
          position: fixed; inset: 0; z-index: 0; overflow: hidden;
          background: radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.15) 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.1) 0%, transparent 50%),
                      radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.08) 0%, transparent 40%),
                      #0a0a12;
        }
        .home-orb {
          position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5;
          pointer-events: none;
        }
        .home-orb-1 {
          width: 400px; height: 400px; top: -100px; left: -80px;
          background: rgba(124,58,237,0.25);
          animation: orb-float-1 20s ease-in-out infinite;
        }
        .home-orb-2 {
          width: 350px; height: 350px; bottom: -50px; right: -60px;
          background: rgba(59,130,246,0.2);
          animation: orb-float-2 25s ease-in-out infinite;
        }
        .home-orb-3 {
          width: 250px; height: 250px; top: 40%; left: 60%;
          background: rgba(236,72,153,0.15);
          animation: orb-float-1 18s ease-in-out infinite reverse;
        }
        .home-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
        }
        .home-main {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 100vh; gap: 2rem; padding: 2rem;
          animation: fadeIn 0.6s ease-out;
        }
        .home-title {
          font-size: clamp(3rem, 8vw, 5rem); font-weight: 900;
          background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #ec4899 100%);
          background-size: 200% 200%;
          animation: gradientShift 6s ease infinite;
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em; line-height: 1.1; text-align: center;
        }
        .home-subtitle {
          color: #8888aa; font-size: 1.25rem; text-align: center;
          max-width: 400px; line-height: 1.5;
        }
        .home-subtitle strong { color: #a78bfa; font-weight: 600; }
        .home-buttons { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
        .home-btn {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 1rem 2.25rem; border-radius: 0.875rem;
          font-weight: 700; font-size: 1.1rem; text-decoration: none;
          transition: all 0.2s ease;
          cursor: pointer; border: none;
        }
        .home-btn-primary {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: #fff;
          box-shadow: 0 4px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .home-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .home-btn-secondary {
          background: rgba(255,255,255,0.05);
          color: #a78bfa;
          border: 2px solid rgba(167,139,250,0.3);
          backdrop-filter: blur(12px);
        }
        .home-btn-secondary:hover {
          transform: translateY(-2px);
          background: rgba(167,139,250,0.1);
          border-color: rgba(167,139,250,0.5);
        }
        .home-badge {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 1rem; border-radius: 9999px;
          background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.2);
          color: #a78bfa; font-size: 0.8rem; font-weight: 600;
          animation: fadeIn 0.8s ease-out 0.2s both;
        }
        .home-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22c55e; animation: pulse 2s ease-in-out infinite;
        }
        .home-features {
          display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center;
          margin-top: 1rem; animation: fadeIn 0.8s ease-out 0.4s both;
        }
        .home-feature {
          display: flex; align-items: center; gap: 0.5rem;
          color: #6b7280; font-size: 0.875rem;
        }
        .home-feature-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem;
        }
      `}</style>

      <div className="home-bg">
        <div className="home-orb home-orb-1" />
        <div className="home-orb home-orb-2" />
        <div className="home-orb home-orb-3" />
        <div className="home-grid" />
      </div>

      <main className="home-main">
        <div className="home-badge">
          <span className="home-badge-dot" />
          Party Gaming Platform
        </div>

        <h1 className="home-title">GamingCouch</h1>

        <p className="home-subtitle">
          Turn your phone into a <strong>game controller</strong>.
          Play party games on your TV. No app download needed.
        </p>

        <div className="home-buttons">
          <Link href="/host" className="home-btn home-btn-primary">
            Host a Game
          </Link>
          <Link href="/join" className="home-btn home-btn-secondary">
            Join with Phone
          </Link>
        </div>

        <div className="home-features">
          <div className="home-feature">
            <span className="home-feature-icon">8+</span>
            Party Games
          </div>
          <div className="home-feature">
            <span className="home-feature-icon">2-8</span>
            Players
          </div>
          <div className="home-feature">
            <span className="home-feature-icon">0s</span>
            Setup Time
          </div>
        </div>
      </main>
    </>
  );
}
