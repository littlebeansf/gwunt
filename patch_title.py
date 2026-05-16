#!/usr/bin/env python3
"""Patch App.tsx to replace TitleBackground and fix mobile hand."""

content = open('/home/user/workspace/gwunt/client/src/App.tsx').read()

# ─── 1. REPLACE TitleBackground ─────────────────────────────────────────────
OLD_TITLE_START = '// ============================\n// Animated Title Background (Canvas)\n// ============================'
OLD_TITLE_END   = '// ============================\n// Title Screen'

start_idx = content.find(OLD_TITLE_START)
end_idx   = content.find(OLD_TITLE_END)
assert start_idx != -1, "Could not find TitleBackground start"
assert end_idx   != -1, "Could not find TitleBackground end"

NEW_TITLE_BG = r"""// ============================
// Animated Title Background — Faction Slideshow + Particles
// ============================
const FACTION_IMAGES = [
  './card-art/faction_hellenic.jpg',
  './card-art/faction_norse.jpg',
  './card-art/faction_slavic.jpg',
  './card-art/faction_celtic.jpg',
  './card-art/faction_egyptian.jpg',
  './card-art/faction_vedic.jpg',
];

function TitleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);

  // ── Faction image state ──────────────────────────────────────────────────
  const imgRef       = useRef<HTMLImageElement[]>([]);
  const curIdxRef    = useRef(0);
  const nextIdxRef   = useRef(1);
  const fadeRef      = useRef(0);    // 0-1 blend toward next image
  const holdRef      = useRef(0);    // ms spent on current image
  const HOLD_MS      = 5000;         // show each faction for 5 s
  const FADE_MS      = 1800;         // cross-fade duration
  const panOffRef    = useRef<{x:number,y:number}[]>(
    FACTION_IMAGES.map(() => ({ x: Math.random() * 0.04, y: Math.random() * 0.04 }))
  );
  const kenRef       = useRef(0);    // Ken Burns progress 0-1 per slide

  // Preload all images
  useEffect(() => {
    FACTION_IMAGES.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      imgRef.current[i] = img;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    // ── Particles ───────────────────────────────────────────────────────────
    const RUNE_CHARS = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ','ᛇ','ᛈ','ᛉ','ᛊ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ','ᛟ'];
    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; life: number; maxLife: number;
      type: 'ember' | 'rune' | 'star';
      char?: string; hue: number; rotation: number; rotSpeed: number;
    }
    const particles: Particle[] = [];
    const spawn = (): Particle => {
      const type = Math.random() < 0.5 ? 'ember' : Math.random() < 0.6 ? 'rune' : 'star';
      const maxLife = 4000 + Math.random() * 6000;
      return {
        x: Math.random() * W, y: H + 20,
        vx: (Math.random() - 0.5) * 0.4, vy: -(0.3 + Math.random() * 0.8),
        size: type === 'ember' ? 1.5 + Math.random() * 2.5 : type === 'rune' ? 10 + Math.random() * 14 : 1 + Math.random() * 1.5,
        opacity: 0, life: 0, maxLife,
        type, char: RUNE_CHARS[Math.floor(Math.random() * RUNE_CHARS.length)],
        hue: type === 'ember' ? 35 + Math.random() * 25 : 220 + Math.random() * 40,
        rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.01,
      };
    };
    for (let i = 0; i < 60; i++) {
      const p = spawn(); p.y = Math.random() * H;
      p.life = Math.random() * p.maxLife; particles.push(p);
    }

    // ── Rings ───────────────────────────────────────────────────────────────
    const rings = [
      { r: 160, speed: 0.0003, dashes: 6,  color: 'rgba(200,160,64,0.08)' },
      { r: 260, speed: -0.0002, dashes: 8, color: 'rgba(100,80,200,0.05)'  },
      { r: 380, speed: 0.00015, dashes: 12,color: 'rgba(200,160,64,0.04)' },
    ];
    let ringAngle = 0;
    let last = performance.now();
    let spawnTimer = 0;

    // ── Draw loop ────────────────────────────────────────────────────────────
    const draw = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      spawnTimer += dt;

      ctx.clearRect(0, 0, W, H);

      // ── Layer 1: faction image slideshow ──────────────────────────────────
      const imgs = imgRef.current;
      const ci = curIdxRef.current;
      const ni = nextIdxRef.current;

      const drawFactionImg = (img: HTMLImageElement, alpha: number, kenProgress: number) => {
        if (!img || !img.complete || img.naturalWidth === 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Ken Burns: very slow zoom in on current slide
        const scale = 1 + kenProgress * 0.06;
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const fw = W * scale, fh = H * scale;
        const ox = (W - fw) / 2, oy = (H - fh) / 2;
        const aspect = iw / ih;
        let sw = fw, sh = fw / aspect;
        if (sh < fh) { sh = fh; sw = fh * aspect; }
        const sx = (W - sw) / 2, sy = (H - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
        ctx.restore();
      };

      // Update Ken Burns + hold timer
      holdRef.current  += dt;
      kenRef.current    = Math.min(holdRef.current / (HOLD_MS + FADE_MS), 1);

      if (holdRef.current >= HOLD_MS && fadeRef.current < 1) {
        fadeRef.current = Math.min((holdRef.current - HOLD_MS) / FADE_MS, 1);
      }
      if (holdRef.current >= HOLD_MS + FADE_MS) {
        // Switch to next
        curIdxRef.current  = ni;
        nextIdxRef.current = (ni + 1) % FACTION_IMAGES.length;
        fadeRef.current    = 0;
        holdRef.current    = 0;
        kenRef.current     = 0;
      }

      // Draw current image (fading out if transitioning)
      drawFactionImg(imgs[ci], 1 - fadeRef.current * 0.9, kenRef.current);
      // Draw next image (fading in)
      if (fadeRef.current > 0) {
        drawFactionImg(imgs[ni], fadeRef.current, 0);
      }

      // ── Layer 2: dark cinematic vignette + colour grading ─────────────────
      // Strong vignette so UI remains legible
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, Math.max(W,H)*0.85);
      vig.addColorStop(0, 'rgba(5,5,16,0.55)');
      vig.addColorStop(0.5,'rgba(5,5,16,0.72)');
      vig.addColorStop(1, 'rgba(5,5,16,0.92)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // Top gradient (extra darkening)
      const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.35);
      topGrad.addColorStop(0, 'rgba(5,5,16,0.75)');
      topGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, W, H);

      // Bottom gradient
      const botGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
      botGrad.addColorStop(0, 'transparent');
      botGrad.addColorStop(1, 'rgba(5,5,16,0.88)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, 0, W, H);

      // Gold atmospheric glow at center
      const glow = ctx.createRadialGradient(W/2, H*0.42, 0, W/2, H*0.42, W*0.35);
      glow.addColorStop(0, 'rgba(200,150,40,0.08)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // ── Layer 3: rotating rings ───────────────────────────────────────────
      ringAngle += dt * 0.0001;
      const cx = W / 2, cy = H * 0.42;
      rings.forEach(ring => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ringAngle * ring.speed * 1000);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([ring.r * 0.2, ring.r * (1 / ring.dashes - 0.2)]);
        ctx.beginPath(); ctx.arc(0, 0, ring.r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      });

      // ── Layer 4: light rays ───────────────────────────────────────────────
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + ringAngle * 0.15;
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.0005 + i * 0.8);
        const rayGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle)*W*0.6, cy + Math.sin(angle)*W*0.6);
        rayGrad.addColorStop(0, `rgba(200,160,64,${0.05 * pulse})`);
        rayGrad.addColorStop(0.3, `rgba(200,160,64,${0.018 * pulse})`);
        rayGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rayGrad;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W*0.6,-W*0.05); ctx.lineTo(W*0.6,W*0.05); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // ── Layer 5: particles ────────────────────────────────────────────────
      if (spawnTimer > 120) { spawnTimer = 0; if (particles.length < 80) particles.push(spawn()); }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life > p.maxLife) { particles.splice(i, 1); particles.push(spawn()); continue; }
        const progress = p.life / p.maxLife;
        p.opacity = progress < 0.15 ? progress / 0.15 : progress > 0.8 ? 1-(progress-0.8)/0.2 : 1;
        p.x += p.vx * dt * 0.016; p.y += p.vy * dt * 0.016; p.rotation += p.rotSpeed * dt;
        if (p.type === 'ember') {
          ctx.save(); ctx.globalAlpha = p.opacity * 0.85;
          const grd = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*2);
          grd.addColorStop(0, `hsla(${p.hue},90%,80%,1)`);
          grd.addColorStop(0.5,`hsla(${p.hue},80%,60%,0.5)`);
          grd.addColorStop(1,'transparent');
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2,0,Math.PI*2); ctx.fill(); ctx.restore();
        } else if (p.type === 'rune') {
          ctx.save(); ctx.globalAlpha = p.opacity * 0.4;
          ctx.translate(p.x,p.y); ctx.rotate(p.rotation);
          ctx.font = `${p.size}px serif`; ctx.fillStyle = `hsla(${p.hue},60%,75%,1)`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.char!, 0, 0); ctx.restore();
        } else {
          ctx.save(); ctx.globalAlpha = p.opacity * 0.65;
          ctx.fillStyle = `hsla(${p.hue},70%,90%,1)`;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

"""

content = content[:start_idx] + NEW_TITLE_BG + content[end_idx:]

# ─── 2. FIX MOBILE HAND — flex-wrap instead of horizontal scroll ────────────
OLD_HAND = """          {/* Hand scroll */}
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {state.player.hand.map(card => (
              <div key={card.instanceId}
                onClick={() => handleMobileTapCard(card)}
                onContextMenu={e => { e.preventDefault(); setZoomedCard(card); }}
                style={{ flexShrink: 0, position: 'relative', outline: selectedCard?.instanceId === card.instanceId ? `2px solid #C8A040` : 'none', borderRadius: 6, boxShadow: selectedCard?.instanceId === card.instanceId ? '0 0 12px rgba(200,160,64,0.6)' : 'none' }}
              >
                <CardComponent
                  card={card} size=\"sm\"
                  style={{ opacity: !canPlay ? 0.5 : 1 }}
                />
              </div>
            ))}
            {state.player.hand.length === 0 && (
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#2A2A3A', padding: '8px 0' }}>No cards in hand</div>
            )}
          </div>"""

NEW_HAND = """          {/* Hand grid — wraps to multiple rows so all cards visible on iPhone */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 2, justifyContent: 'flex-start' }}>
            {state.player.hand.map(card => (
              <div key={card.instanceId}
                onClick={() => handleMobileTapCard(card)}
                onContextMenu={e => { e.preventDefault(); setZoomedCard(card); }}
                style={{ position: 'relative', outline: selectedCard?.instanceId === card.instanceId ? `2px solid #C8A040` : 'none', borderRadius: 6, boxShadow: selectedCard?.instanceId === card.instanceId ? '0 0 14px rgba(200,160,64,0.7)' : 'none' }}
              >
                <CardComponent
                  card={card} size=\"sm\"
                  style={{ width: 60, height: 90, opacity: !canPlay ? 0.5 : 1 }}
                />
              </div>
            ))}
            {state.player.hand.length === 0 && (
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#2A2A3A', padding: '8px 0' }}>No cards in hand</div>
            )}
          </div>"""

assert OLD_HAND in content, "Could not find old mobile hand HTML"
content = content.replace(OLD_HAND, NEW_HAND, 1)

# ─── 3. FIX MULLIGAN SCREEN — make it scrollable on mobile ──────────────────
OLD_MULLIGAN_WRAPPER = '    <div className="overlay-screen" style={{ padding: 24, background: \'rgba(8,8,16,0.97)\' }}>'
NEW_MULLIGAN_WRAPPER = '    <div className="overlay-screen" style={{ padding: 16, background: \'rgba(8,8,16,0.97)\', overflowY: \'auto\' }}>'

assert OLD_MULLIGAN_WRAPPER in content, "Could not find old MulliganScreen wrapper"
content = content.replace(OLD_MULLIGAN_WRAPPER, NEW_MULLIGAN_WRAPPER, 1)

# ─── Save ────────────────────────────────────────────────────────────────────
with open('/home/user/workspace/gwunt/client/src/App.tsx', 'w') as f:
    f.write(content)

print("✅ All patches applied successfully")
print(f"  - New file length: {len(content)} chars ({len(content.splitlines())} lines)")
