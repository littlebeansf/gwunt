import { useEffect, useRef } from 'react';
import { CardArt } from './art/CardArt';
import { FACTIONS } from './data/factions';
import { audio } from './audio/AudioEngine';

// ============================
// Animated Particle Background
// ============================
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Golden dust particles
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: -Math.random() * 0.6 - 0.2,
      alpha: Math.random(),
      dAlpha: (Math.random() - 0.5) * 0.01,
      gold: Math.random() > 0.6,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? '#C8A040' : '#8080C0';
        ctx.fill();
        ctx.restore();

        p.x += p.dx;
        p.y += p.dy;
        p.alpha += p.dAlpha;

        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.alpha <= 0 || p.alpha >= 1) p.dAlpha *= -1;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0, opacity: 0.5,
    }} />
  );
}

// ============================
// Feature Card
// ============================
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: 'rgba(14,10,26,0.8)',
      border: '1px solid rgba(200,160,64,0.2)',
      borderRadius: 8,
      padding: '24px 20px',
      transition: 'border-color 0.25s, transform 0.25s',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,160,64,0.5)';
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,160,64,0.2)';
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
    }}
    >
      <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontWeight: 700, color: '#E8D080', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'IM Fell English, Georgia, serif', fontSize: '0.82rem', color: '#8080A0', lineHeight: 1.6, fontStyle: 'italic' }}>{desc}</div>
    </div>
  );
}

// ============================
// Faction Preview Strip
// ============================
const FACTION_IDS = ['hellenic', 'vedic', 'norse', 'slavic', 'celtic', 'egyptian'] as const;

function FactionStrip() {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', padding: '0 20px' }}>
      {FACTION_IDS.map(fid => {
        const f = FACTIONS[fid];
        if (!f) return null;
        return (
          <div key={fid} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            width: 120,
          }}>
            <div style={{
              width: 100, height: 70, borderRadius: 8, overflow: 'hidden',
              border: `1px solid ${f.colors.accent}40`,
              boxShadow: `0 0 12px ${f.colors.accent}20`,
              transition: 'box-shadow 0.25s',
            }}>
              <CardArt artKey={`faction_${fid === 'hellenic' ? 'hellenic' : fid === 'vedic' ? 'vedic' : fid === 'norse' ? 'norse' : fid === 'slavic' ? 'slavic' : fid === 'celtic' ? 'celtic' : 'egyptian'}`} width={100} height={70} />
            </div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', color: f.colors.accent, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>{f.emoji} {f.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================
// Scanline overlay
// ============================
function Scanlines() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
    }} />
  );
}

// ============================
// Landing Page
// ============================
export default function LandingPage({ onPlay }: { onPlay: () => void }) {
  // Start ambient music
  useEffect(() => {
    const unlock = async () => {
      await audio.resume();
      await audio.playMusic('title');
      await audio.preload();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
  }, []);

  const handlePlay = () => {
    audio.playSfx('button_click');
    onPlay();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#080810', color: '#E8E0C8',
      fontFamily: 'Cinzel, serif',
      overflowX: 'hidden', overflowY: 'auto',
    }}>
      <ParticleCanvas />
      <Scanlines />

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,8,16,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(200,160,64,0.12)',
        padding: '0 clamp(1rem, 4vw, 3rem)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 32 32" width={28} height={28} fill="none">
            <polygon points="16,2 20,12 30,12 22,18 25,28 16,22 7,28 10,18 2,12 12,12" fill="none" stroke="#C8A040" strokeWidth="1.5" />
            <line x1="16" y1="2" x2="16" y2="30" stroke="#C8A040" strokeWidth="0.8" opacity="0.5" />
          </svg>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 900, color: '#C8A040', letterSpacing: '0.3em', textTransform: 'uppercase' }}>GWUNT</span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {['Factions', 'Gallery', 'GitHub'].map((label, i) => (
            <a
              key={label}
              href={i === 2 ? 'https://github.com/littlebeansf/gwunt' : '#'}
              target={i === 2 ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={i === 0 ? (e) => { e.preventDefault(); document.getElementById('factions')?.scrollIntoView({ behavior: 'smooth' }); } : undefined}
              style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: '#5A5A7A', letterSpacing: '0.12em', textDecoration: 'none', textTransform: 'uppercase', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#C8A040'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#5A5A7A'}
            >{label}</a>
          ))}
          <button
            onClick={handlePlay}
            style={{
              fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.72rem',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              padding: '7px 20px', border: '1px solid #C8A040', borderRadius: 4,
              background: 'rgba(200,160,64,0.12)', color: '#F0C84A',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,64,0.22)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(200,160,64,0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,64,0.12)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
          >
            Play Now
          </button>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ── HERO ── */}
        <section style={{
          minHeight: 'calc(100vh - 56px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px 80px',
          position: 'relative',
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 16px', borderRadius: 3,
            border: '1px solid rgba(200,160,64,0.2)',
            background: 'rgba(200,160,64,0.06)',
            fontFamily: 'Cinzel, serif', fontSize: '0.62rem',
            color: '#8A7A50', letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 32,
            animation: 'fadeInDown 0.6s ease',
          }}>
            <span style={{ color: '#C8A040' }}>✦</span>
            Mythology Card Battler
            <span style={{ color: '#C8A040' }}>✦</span>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'Cinzel, serif', fontWeight: 900,
            fontSize: 'clamp(3.5rem, 10vw, 7rem)',
            letterSpacing: '0.3em',
            color: '#C8A040',
            textShadow: '0 0 60px rgba(200,160,64,0.4), 0 0 120px rgba(200,160,64,0.15)',
            marginBottom: 20, lineHeight: 1,
            animation: 'fadeInDown 0.7s ease',
          }}>
            GWUNT
          </h1>

          {/* Subtitle */}
          <p style={{
            fontFamily: 'IM Fell English, Georgia, serif',
            fontSize: 'clamp(0.9rem, 2vw, 1.25rem)',
            color: '#8080A0', fontStyle: 'italic', lineHeight: 1.7,
            maxWidth: 560, marginBottom: 48,
            animation: 'fadeInDown 0.8s ease',
          }}>
            Six mythologies. Three rows. One legend. Command gods, unleash weather, and outwit your opponent in this turn-based card battle of ancient myth.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeInDown 0.9s ease' }}>
            <button
              onClick={handlePlay}
              style={{
                fontFamily: 'Cinzel, serif', fontWeight: 700,
                fontSize: '0.95rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                padding: '14px 44px',
                border: '2px solid #C8A040', borderRadius: 6,
                background: 'rgba(200,160,64,0.15)', color: '#F0C84A',
                cursor: 'pointer', transition: 'all 0.25s',
                boxShadow: '0 0 0 rgba(200,160,64,0)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,64,0.25)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(200,160,64,0.35)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,64,0.15)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 rgba(200,160,64,0)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              ⚔ Enter the Field
            </button>
            <a
              href="https://github.com/littlebeansf/gwunt"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'Cinzel, serif', fontWeight: 600,
                fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase',
                padding: '14px 32px',
                border: '1px solid rgba(200,160,64,0.25)', borderRadius: 6,
                background: 'transparent', color: '#8888A8',
                cursor: 'pointer', transition: 'all 0.2s',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C8A040'; (e.currentTarget as HTMLElement).style.borderColor = '#C8A04060'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8888A8'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,160,64,0.25)'; }}
            >
              GitHub ↗
            </a>
          </div>

          {/* Scroll hint */}
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: 'bounce 2s ease-in-out infinite' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#3A3A5A', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Scroll</div>
            <div style={{ width: 1, height: 24, background: 'linear-gradient(to bottom, #3A3A5A, transparent)' }} />
          </div>
        </section>

        {/* ── GAME FEATURES ── */}
        <section style={{ padding: 'clamp(40px, 6vw, 80px) clamp(1rem, 6vw, 80px)', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#604020', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12 }}>How to Play</div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#C8A040', fontWeight: 700, letterSpacing: '0.1em' }}>Ancient Warfare, Card by Card</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FeatureCard icon="⚔" title="3-Round Format" desc="Best of 3 rounds. Win 2 to claim victory. Strategic passing lets you sacrifice a round to win the war." />
            <FeatureCard icon="🌩" title="Weather Effects" desc="Play weather cards to curse an entire battlefield row, reducing all non-heroic units to strength 1." />
            <FeatureCard icon="👑" title="Leader Abilities" desc="Each faction has a unique leader power. Use it once per match at the decisive moment." />
            <FeatureCard icon="🔮" title="Special Abilities" desc="Seer draws, Warband summons, Doom strikes, Inspire buffs — 10 ability types across 106 cards." />
            <FeatureCard icon="🤖" title="Smart AI Opponent" desc="The AI reads the board, prioritises threats, and plays optimally. It will challenge your every move." />
            <FeatureCard icon="🎵" title="Full Atmosphere" desc="Original RPG score, card sound effects, and animated weather overlays — fully immersive." />
          </div>
        </section>

        {/* ── FACTIONS ── */}
        <section id="factions" style={{ padding: 'clamp(40px, 6vw, 80px) clamp(1rem, 6vw, 80px)', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#604020', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12 }}>Choose your side</div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#C8A040', fontWeight: 700, letterSpacing: '0.1em' }}>Six Mythologies</h2>
            <p style={{ fontFamily: 'IM Fell English, Georgia, serif', fontSize: '0.9rem', color: '#8080A0', fontStyle: 'italic', marginTop: 12, maxWidth: 480, margin: '12px auto 0' }}>
              From the bronze spears of Olympus to the frost wolves of Asgard — every faction fights differently.
            </p>
          </div>

          <FactionStrip />

          {/* Faction detail cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 40 }}>
            {FACTION_IDS.map(fid => {
              const f = FACTIONS[fid];
              if (!f) return null;
              return (
                <div key={fid} style={{
                  background: 'rgba(14,10,26,0.85)',
                  border: `1px solid ${f.colors.accent}25`,
                  borderRadius: 10, padding: '20px 20px 16px',
                  transition: 'border-color 0.25s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = f.colors.accent + '60'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = f.colors.accent + '25'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `1px solid ${f.colors.accent}30` }}>
                      <CardArt artKey={`faction_${fid}`} width={48} height={48} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontWeight: 700, color: f.colors.accent, letterSpacing: '0.06em' }}>{f.emoji} {f.name}</div>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: f.colors.accent + '70', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.subtitle}</div>
                    </div>
                  </div>
                  <p style={{ fontFamily: 'IM Fell English, Georgia, serif', fontSize: '0.8rem', color: '#7070A0', fontStyle: 'italic', lineHeight: 1.55, marginBottom: 10 }}>{f.description}</p>
                  <div style={{ borderTop: `1px solid ${f.colors.accent}15`, paddingTop: 10 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: f.colors.accent + '80', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Leader · {f.leaderName}
                    </div>
                    <div style={{ fontFamily: 'IM Fell English, Georgia, serif', fontSize: '0.75rem', color: '#6060A0', fontStyle: 'italic', lineHeight: 1.4 }}>{f.leaderAbility}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section style={{
          padding: 'clamp(40px, 8vw, 100px) 24px',
          textAlign: 'center',
          background: 'linear-gradient(to bottom, transparent, rgba(200,160,64,0.03) 50%, transparent)',
          position: 'relative',
        }}>
          {/* Decorative line */}
          <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, rgba(200,160,64,0.3))', margin: '0 auto 40px' }} />

          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', color: '#C8A040', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 16 }}>
            The battlefield awaits.
          </h2>
          <p style={{ fontFamily: 'IM Fell English, Georgia, serif', fontSize: '0.9rem', color: '#6060A0', fontStyle: 'italic', marginBottom: 40 }}>
            Choose your mythology. Master the rows. Let the myths collide.
          </p>

          <button
            onClick={handlePlay}
            style={{
              fontFamily: 'Cinzel, serif', fontWeight: 700,
              fontSize: '1rem', letterSpacing: '0.25em', textTransform: 'uppercase',
              padding: '16px 52px',
              border: '2px solid #C8A040', borderRadius: 6,
              background: 'rgba(200,160,64,0.12)', color: '#F0C84A',
              cursor: 'pointer', transition: 'all 0.25s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,64,0.22)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(200,160,64,0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,64,0.12)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
          >
            ⚔ Play Gwunt
          </button>

          {/* Footer */}
          <div style={{ marginTop: 80, paddingTop: 24, borderTop: '1px solid rgba(200,160,64,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#2A2A4A', letterSpacing: '0.2em' }}>GWUNT © 2026</span>
              <span style={{ color: '#2A2A4A' }}>·</span>
              <a href="https://github.com/littlebeansf/gwunt" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#3A3A5A', letterSpacing: '0.12em', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = '#C8A040'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#3A3A5A'}
              >GitHub</a>
              <span style={{ color: '#2A2A4A' }}>·</span>
              <a href="https://littlebeansf.github.io/gwunt/" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#3A3A5A', letterSpacing: '0.12em', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = '#C8A040'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#3A3A5A'}
              >GitHub Pages</a>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </div>
  );
}
