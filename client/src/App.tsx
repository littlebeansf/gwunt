import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, GamePhase, Faction, Row, CardInstance, GameEvent } from '../../shared/schema';
import { 
  createInitialState, 
  applyAction, 
  checkRoundEnd, 
  aiDecide,
  getTotalScore,
  getRowScore
} from './engine/gameEngine';
import { CardArt } from './art/CardArt';
import { FACTIONS } from './data/factions';
import { ALL_CARDS } from './data/cards';
import { audio } from './audio/AudioEngine';

// ============================
// Mobile Detection
// ============================
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

// ============================
// Save / Load State
// ============================
const SAVE_KEY = 'gwunt_save_v1';

function serializeState(state: GameState): string {
  try { return btoa(JSON.stringify(state)); } catch { return ''; }
}

function deserializeState(s: string): GameState | null {
  try { return JSON.parse(atob(s)) as GameState; } catch { return null; }
}

function saveGame(state: GameState) {
  try { sessionStorage.setItem(SAVE_KEY, serializeState(state)); } catch {}
}

function loadSavedGame(): GameState | null {
  try {
    const s = sessionStorage.getItem(SAVE_KEY);
    return s ? deserializeState(s) : null;
  } catch { return null; }
}

function clearSave() {
  try { sessionStorage.removeItem(SAVE_KEY); } catch {}
}

// ============================
// Card Component
// ============================
interface CardProps {
  card: CardInstance;
  size?: 'sm' | 'md' | 'lg';
  onDragStart?: (e: React.PointerEvent, card: CardInstance) => void;
  onDragEnd?: () => void;
  inHand?: boolean;
  dragging?: boolean;
  onClick?: () => void;
  dimmed?: boolean;
  style?: React.CSSProperties;
}

const ABILITY_COLORS: Record<string, { bg: string; text: string }> = {
  heroic:    { bg: 'rgba(200,160,64,0.25)',  text: '#F0C84A' },
  inspire:   { bg: 'rgba(100,180,100,0.25)', text: '#80D080' },
  seer:      { bg: 'rgba(180,100,200,0.25)', text: '#C070E0' },
  restore:   { bg: 'rgba(100,160,220,0.25)', text: '#70A0E8' },
  warband:   { bg: 'rgba(220,140,60,0.25)',  text: '#E89040' },
  doom:      { bg: 'rgba(200,50,50,0.25)',   text: '#E05050' },
  commander: { bg: 'rgba(200,160,64,0.2)',   text: '#D0A030' },
  oathbound: { bg: 'rgba(220,180,100,0.2)',  text: '#D0A050' },
  weather:   { bg: 'rgba(100,140,220,0.2)',  text: '#80A8E0' },
  special:   { bg: 'rgba(160,100,200,0.2)',  text: '#A070D0' },
  none:      { bg: 'transparent',            text: 'transparent' },
};

const ROW_COLORS: Record<string, string> = {
  close:  '#C03030',
  ranged: '#3080C0',
  ritual: '#8030C0',
};

// Card dimensions — larger than before for better art visibility
const CARD_DIMS = {
  sm: { w: 84,  h: 126 },
  md: { w: 104, h: 156 },
  lg: { w: 130, h: 195 },
};

function CardComponent({ card, size = 'md', onDragStart, onDragEnd, dragging, onClick, dimmed, style }: CardProps) {
  const dims = CARD_DIMS[size];
  const abilityColor = ABILITY_COLORS[card.def.ability] || ABILITY_COLORS.none;
  const isHeroic = card.def.ability === 'heroic';
  const [imgLoaded, setImgLoaded] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (onDragStart) { audio.playSfx('card_hover'); onDragStart(e, card); }
  };

  return (
    <div
      className={`card-frame ${isHeroic ? 'heroic' : ''} ${dragging ? 'dragging' : ''} ${dimmed ? 'opacity-40' : ''}`}
      style={{ width: dims.w, height: dims.h, flexShrink: 0, ...style }}
      onPointerDown={handlePointerDown}
      onPointerUp={onDragEnd}
      onClick={onClick}
    >
      {/* Skeleton shimmer while loading */}
      {!imgLoaded && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: dims.h * 0.62,
          borderRadius: '6px 6px 0 0',
          background: 'linear-gradient(90deg, #1A1A26 25%, #252535 50%, #1A1A26 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
          zIndex: 1,
        }} />
      )}

      {/* Art area */}
      <div style={{ width: '100%', height: dims.h * 0.62, overflow: 'hidden', borderRadius: '6px 6px 0 0' }}>
        <CardArt
          artKey={card.def.artKey}
          width={dims.w}
          height={dims.h * 0.62}
          weatherType={card.def.type === 'weather' ? card.def.artKey : undefined}
          onLoad={() => setImgLoaded(true)}
        />
      </div>

      {/* Strength badge */}
      <div style={{
        position: 'absolute', top: 4, left: 4,
        width: 26, height: 26, borderRadius: '50%',
        background: card.isWeatherReduced ? '#1A3A6E' : card.def.strength >= 8 ? 'rgba(200,50,50,0.9)' : 'rgba(8,8,16,0.9)',
        border: `2px solid ${isHeroic ? '#F0C84A' : card.isWeatherReduced ? '#4080C0' : 'rgba(200,160,64,0.6)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Cinzel, serif', fontWeight: 900,
        fontSize: size === 'sm' ? '0.65rem' : '0.75rem',
        color: isHeroic ? '#F0C84A' : card.isWeatherReduced ? '#80B0E8' : '#F0F0F0',
        lineHeight: 1, zIndex: 10,
      }}>
        {card.currentStrength}
      </div>

      {/* Row dot or type badge */}
      {card.def.type === 'unit' && card.def.row && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 14, height: 14, borderRadius: '50%',
          background: ROW_COLORS[card.def.row] || '#888', opacity: 0.85, zIndex: 10,
        }} title={card.def.row} />
      )}
      {card.def.type !== 'unit' && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          padding: '1px 4px', borderRadius: 3,
          background: card.def.type === 'weather' ? 'rgba(100,140,220,0.8)' : 'rgba(160,100,200,0.8)',
          fontSize: '0.5rem', fontFamily: 'Cinzel, serif', fontWeight: 700,
          color: '#fff', letterSpacing: '0.05em', zIndex: 10,
        }}>
          {card.def.type === 'weather' ? 'WTH' : 'SPL'}
        </div>
      )}

      {/* Name and ability */}
      <div style={{ padding: '4px 4px 3px', flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{
          fontFamily: 'Cinzel, serif',
          fontSize: size === 'sm' ? '0.52rem' : '0.6rem',
          fontWeight: 700, color: '#E8E0C8', letterSpacing: '0.02em', lineHeight: 1.2,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {card.def.name}
        </div>
        {card.def.ability !== 'none' && (
          <div className="ability-badge" style={{
            background: abilityColor.bg, color: abilityColor.text,
            border: `1px solid ${abilityColor.text}40`,
            alignSelf: 'flex-start', marginTop: 'auto',
          }}>
            {card.def.ability}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================
// Card Zoom Modal
// ============================
function CardZoomModal({ card, onClose }: { card: CardInstance; onClose: () => void }) {
  const isMobile = useIsMobile();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const abilityColor = ABILITY_COLORS[card.def.ability] || ABILITY_COLORS.none;
  const isHeroic = card.def.ability === 'heroic';
  const artW = isMobile ? Math.min(window.innerWidth * 0.7, 220) : 280;
  const artH = isMobile ? artW * 1.5 : 420;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(4,4,12,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.18s ease',
        cursor: 'zoom-out',
        padding: isMobile ? 16 : 0,
        overflowY: 'auto',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 16 : 32,
        alignItems: 'center',
        animation: 'zoomIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'default',
        maxHeight: isMobile ? 'none' : undefined,
      }}>
        {/* Large card art */}
        <div style={{
          width: artW, height: artH,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: `0 0 60px ${isHeroic ? 'rgba(200,160,64,0.5)' : 'rgba(100,80,200,0.3)'}, 0 30px 80px rgba(0,0,0,0.9)`,
          border: `2px solid ${isHeroic ? '#C8A040' : '#3A3A5E'}`,
          position: 'relative',
          flexShrink: 0,
        }}>
          <CardArt
            artKey={card.def.artKey}
            width={artW}
            height={artH}
            weatherType={card.def.type === 'weather' ? card.def.artKey : undefined}
          />
          {/* Strength overlay */}
          <div style={{
            position: 'absolute', top: 10, left: 10,
            width: 44, height: 44, borderRadius: '50%',
            background: card.isWeatherReduced ? '#1A3A6E' : card.def.strength >= 8 ? 'rgba(200,50,50,0.95)' : 'rgba(8,8,16,0.95)',
            border: `3px solid ${isHeroic ? '#F0C84A' : card.isWeatherReduced ? '#4080C0' : 'rgba(200,160,64,0.8)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Cinzel, serif', fontWeight: 900, fontSize: '1.2rem',
            color: isHeroic ? '#F0C84A' : '#F0F0F0',
            boxShadow: isHeroic ? '0 0 20px rgba(240,200,74,0.6)' : undefined,
          }}>
            {card.currentStrength}
          </div>
          {card.def.type !== 'unit' && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              padding: '4px 8px', borderRadius: 4,
              background: card.def.type === 'weather' ? 'rgba(100,140,220,0.9)' : 'rgba(160,100,200,0.9)',
              fontSize: '0.65rem', fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#fff',
              letterSpacing: '0.08em',
            }}>
              {card.def.type === 'weather' ? 'WEATHER' : 'SPECIAL'}
            </div>
          )}
        </div>

        {/* Card info panel */}
        <div style={{ width: isMobile ? '100%' : 240, color: '#E8E0C8', maxWidth: isMobile ? 320 : undefined }}>
          <div style={{
            fontFamily: 'Cinzel Decorative, serif', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 700,
            color: isHeroic ? '#F0C84A' : '#E8E0C8',
            letterSpacing: '0.05em', lineHeight: 1.3, marginBottom: 10,
            textShadow: isHeroic ? '0 0 20px rgba(200,160,64,0.5)' : undefined,
          }}>
            {card.def.name}
          </div>

          {card.def.row && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: ROW_COLORS[card.def.row],
              }} />
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#8080A0', textTransform: 'capitalize', letterSpacing: '0.1em' }}>
                {card.def.row} Row
              </span>
            </div>
          )}

          {card.def.ability !== 'none' && (
            <div style={{
              display: 'inline-flex', padding: '4px 12px', borderRadius: 4, marginBottom: 14,
              background: abilityColor.bg, border: `1px solid ${abilityColor.text}50`,
            }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, color: abilityColor.text, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {card.def.ability}
              </span>
            </div>
          )}

          <div style={{
            fontFamily: 'IM Fell English, serif', fontSize: '0.85rem', fontStyle: 'italic',
            color: '#9090B8', lineHeight: 1.6, marginBottom: 18,
            borderLeft: '2px solid #2A2A4A', paddingLeft: 12,
          }}>
            "{card.def.description}"
          </div>

          {card.isWeatherReduced && (
            <div style={{
              padding: '6px 10px', borderRadius: 4,
              background: 'rgba(64,128,192,0.15)', border: '1px solid rgba(64,128,192,0.4)',
              fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#80A8E8',
            }}>
              ❄ Strength reduced by weather
            </div>
          )}

          <div style={{ marginTop: 16, fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#404060', letterSpacing: '0.1em', textAlign: 'center' }}>
            Tap anywhere or press Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// Drag System
// ============================
interface DragState {
  card: CardInstance | null;
  x: number; y: number;
  startX: number; startY: number;
  active: boolean;
}

// ============================
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

// ============================
// Title Screen
// ============================
function TitleScreen({ onPlay, onGallery, hasSave, onLoadSave }: {
  onPlay: () => void; onGallery: () => void; hasSave: boolean; onLoadSave: () => void;
}) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const handlePlay = () => { audio.playSfx('button_click'); onPlay(); };
  const handleGallery = () => { audio.playSfx('button_click'); onGallery(); };
  const handleLoad = () => { audio.playSfx('button_click'); onLoadSave(); };

  return (
    <div className="overlay-screen" style={{ background: 'transparent', overflow: 'hidden' }}>
      <TitleBackground />

      {/* Content */}
      <div style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>
        {/* SVG Logo */}
        <div style={{ animation: 'floatLogo 5s ease-in-out infinite' }}>
          <svg viewBox="0 0 200 80" width="300" height="120" style={{ display: 'block', margin: '0 auto 16px', filter: 'drop-shadow(0 0 20px rgba(200,160,64,0.5))' }}>
            <g opacity="0.9">
              <polygon points="100,5 92,22 85,12 88,30 80,20 84,38 76,28 80,48 100,38 120,48 124,28 116,38 120,20 112,30 115,12 108,22" fill="#C8A040" opacity="0.85" />
              <line x1="100" y1="8" x2="100" y2="70" stroke="#E8C860" strokeWidth="2.5" />
              <polygon points="100,5 97,14 103,14" fill="#F0D060" />
              <rect x="91" y="42" width="18" height="3" rx="1" fill="#C0900A" />
            </g>
            <circle cx="100" cy="40" r="25" fill="none" stroke="#C8A040" strokeWidth="0.8" opacity="0.4" />
            <circle cx="100" cy="40" r="32" fill="none" stroke="#C8A040" strokeWidth="0.4" opacity="0.2" />
          </svg>
        </div>

        <div className="font-title" style={{
          fontSize: '4rem', fontWeight: 900, color: '#F0C84A', letterSpacing: '0.25em',
          textShadow: '0 0 40px rgba(200,160,64,0.7), 0 0 80px rgba(200,160,64,0.3), 0 2px 4px rgba(0,0,0,0.8)',
          animation: 'titleGlow 3s ease-in-out infinite',
        }}>
          GWUNT
        </div>
        <div className="font-heading" style={{
          fontSize: '0.9rem', letterSpacing: '0.5em', color: '#907848',
          marginTop: 8, textTransform: 'uppercase',
          animation: 'fadeIn 1s ease 0.3s both',
        }}>
          Mythology Card Battler
        </div>

        <div style={{ marginTop: 52, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', animation: 'fadeIn 0.8s ease 0.5s both' }}>
          {/* Enter the Field */}
          <button
            onClick={handlePlay}
            onMouseEnter={() => setHoveredBtn('play')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.05rem',
              letterSpacing: '0.28em', textTransform: 'uppercase',
              padding: '16px 56px',
              border: '2px solid #C8A040', borderRadius: 6,
              background: hoveredBtn === 'play' ? 'rgba(200,160,64,0.22)' : 'rgba(200,160,64,0.08)',
              color: '#F0C84A', cursor: 'pointer',
              boxShadow: hoveredBtn === 'play' ? '0 0 35px rgba(200,160,64,0.45), inset 0 0 20px rgba(200,160,64,0.08)' : '0 0 15px rgba(200,160,64,0.15)',
              transition: 'all 0.25s ease',
              position: 'relative', overflow: 'hidden',
            }}
          >
            Enter the Field
          </button>

          {/* Load saved game */}
          {hasSave && (
            <button
              onClick={handleLoad}
              onMouseEnter={() => setHoveredBtn('load')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.82rem',
                letterSpacing: '0.18em', textTransform: 'uppercase',
                padding: '11px 36px',
                border: `1px solid ${hoveredBtn === 'load' ? '#80A0C0' : '#3A4A5E'}`, borderRadius: 6,
                background: hoveredBtn === 'load' ? 'rgba(80,120,180,0.15)' : 'rgba(40,60,100,0.08)',
                color: hoveredBtn === 'load' ? '#A0C0E0' : '#607090', cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              ⚔ Continue Saved Game
            </button>
          )}

          <button
            onClick={handleGallery}
            onMouseEnter={() => setHoveredBtn('gallery')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.78rem',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              padding: '10px 32px',
              border: `1px solid ${hoveredBtn === 'gallery' ? '#C8A040' : '#2A2A3E'}`, borderRadius: 6,
              background: 'transparent',
              color: hoveredBtn === 'gallery' ? '#C8A040' : '#606080', cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          >
            Card Gallery
          </button>
        </div>

        <div className="font-body" style={{ marginTop: 44, color: '#302820', fontSize: '0.75rem', fontStyle: 'italic', letterSpacing: '0.05em' }}>
          Six mythologies. Three rows. One legend.
        </div>
      </div>

      {/* Mute toggle */}
      <MuteButton />
    </div>
  );
}

// ============================
// Mute Button (global)
// ============================
function MuteButton() {
  const [muted, setMuted] = useState(false);
  return (
    <button
      onClick={() => setMuted(audio.toggleMute())}
      title={muted ? 'Unmute' : 'Mute'}
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        width: 36, height: 36, borderRadius: '50%',
        border: '1px solid #2A2A3E',
        background: 'rgba(8,8,16,0.85)',
        color: muted ? '#404060' : '#C8A040',
        cursor: 'pointer', fontSize: '1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        transition: 'all 0.2s',
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

// ============================
// Event Notification Banner (Toast Queue)
// ============================
interface ToastItem {
  id: string;
  event: GameEvent;
  state: 'entering' | 'visible' | 'exiting';
}

function EventNotificationBanner({ events }: { events: GameEvent[] }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;
    const newEvents = events.filter(e => !seenIds.current.has(e.id));
    if (newEvents.length === 0) return;
    newEvents.forEach(e => seenIds.current.add(e.id));

    setToasts(prev => {
      const added: ToastItem[] = newEvents.map(e => ({ id: e.id, event: e, state: 'entering' as const }));
      return [...prev, ...added].slice(-6); // max 6 toasts in queue
    });

    // After 200ms switch entering → visible
    const t1 = setTimeout(() => {
      setToasts(prev => prev.map(t =>
        newEvents.some(e => e.id === t.id) ? { ...t, state: 'visible' as const } : t
      ));
    }, 200);

    // After 3.2s switch visible → exiting
    const t2 = setTimeout(() => {
      setToasts(prev => prev.map(t =>
        newEvents.some(e => e.id === t.id) ? { ...t, state: 'exiting' as const } : t
      ));
    }, 3200);

    // After 3.7s remove
    const t3 = setTimeout(() => {
      setToasts(prev => prev.filter(t => !newEvents.some(e => e.id === t.id)));
    }, 3700);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [events]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 60, right: 12, zIndex: 8500,
      display: 'flex', flexDirection: 'column', gap: 6,
      pointerEvents: 'none', maxWidth: 300,
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`event-notif ${toast.event.type} ${toast.state}`}
        >
          {toast.event.icon && <span style={{ fontSize: '1rem', flexShrink: 0 }}>{toast.event.icon}</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {toast.event.cardName && (
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', fontWeight: 700, color: '#E8D080', letterSpacing: '0.04em' }}>
                {toast.event.cardName}
              </div>
            )}
            <div style={{ fontFamily: 'IM Fell English, serif', fontSize: '0.65rem', color: '#C8C0A8', fontStyle: 'italic', lineHeight: 1.35 }}>
              {toast.event.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================
// Faction Tooltip
// ============================
function FactionTooltip({ factionId, anchorRef, side }: {
  factionId: string;
  anchorRef: React.RefObject<HTMLElement>;
  side: 'left' | 'right';
}) {
  const f = FACTIONS[factionId];
  if (!f) return null;

  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const top = rect.bottom + 6;
    const left = side === 'right' ? rect.left : rect.right - 260;
    setPos({ top, left: Math.max(8, Math.min(left, window.innerWidth - 268)) });
  }, [anchorRef, side]);

  return (
    <div
      className="faction-tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9100,
        width: 260,
        borderColor: f.colors.accent + '60',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div className="faction-tooltip-title" style={{ color: f.colors.accent }}>
        {f.emoji} {f.name}
      </div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: f.colors.accent + '80', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        {f.subtitle}
      </div>
      <div className="faction-tooltip-row">
        <span>Playstyle</span>
        <span>{f.playstyle}</span>
      </div>
      <div className="faction-tooltip-row" style={{ marginTop: 6 }}>
        <span>Leader</span>
        <span style={{ color: f.colors.accent }}>{f.leaderName}</span>
      </div>
      <div className="faction-tooltip-ability">
        {f.leaderAbility}
      </div>
    </div>
  );
}

// ============================
// Cinematic Transition
// ============================
function CinematicTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      animation: 'cinematicIn 0.4s ease forwards',
    }}>
      {/* Flash effect */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(200,160,64,0.4) 0%, transparent 70%)',
        animation: 'cinematicFlash 0.6s ease forwards',
      }} />
      {/* Swords crossing SVG */}
      <div style={{ animation: 'cinematicSwords 1.6s ease forwards', zIndex: 1 }}>
        <svg viewBox="0 0 200 200" width="200" height="200">
          <g style={{ animation: 'swordLeft 1.4s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <line x1="20" y1="180" x2="180" y2="20" stroke="#C8A040" strokeWidth="4" strokeLinecap="round" />
            <polygon points="180,20 168,30 173,35" fill="#F0D060" />
            <rect x="85" y="93" width="30" height="6" rx="3" fill="#A07030" transform="rotate(-45,100,96)" />
          </g>
          <g style={{ animation: 'swordRight 1.4s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <line x1="180" y1="180" x2="20" y2="20" stroke="#C8A040" strokeWidth="4" strokeLinecap="round" />
            <polygon points="20,20 32,30 27,35" fill="#F0D060" />
            <rect x="85" y="93" width="30" height="6" rx="3" fill="#A07030" transform="rotate(45,100,96)" />
          </g>
          <circle cx="100" cy="100" r="8" fill="#F0D060" opacity="0.9" />
          <circle cx="100" cy="100" r="20" fill="none" stroke="#C8A040" strokeWidth="1" opacity="0.4" style={{ animation: 'expandRing 1s ease 0.4s forwards' }} />
        </svg>
      </div>
      <div className="font-title" style={{
        color: '#C8A040', letterSpacing: '0.4em', fontSize: '1.2rem',
        marginTop: 20, opacity: 0,
        animation: 'cinematicText 0.8s ease 0.8s forwards',
        textShadow: '0 0 30px rgba(200,160,64,0.8)',
      }}>
        TO BATTLE
      </div>
    </div>
  );
}

// ============================
// Faction Select Screen
// ============================
function FactionSelectScreen({ onSelect }: { onSelect: (faction: Faction) => void }) {
  const [selected, setSelected] = useState<Faction | null>(null);
  const isMobile = useIsMobile();
  const factions = Object.values(FACTIONS);

  return (
    <div className="overlay-screen scrollable" style={{ padding: isMobile ? '16px 12px' : '20px', background: 'rgba(8,8,16,0.98)' }}>
      <div className="font-title" style={{ fontSize: isMobile ? '1rem' : '1.4rem', color: '#C8A040', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
        Choose Your Mythology
      </div>
      <div className="font-body" style={{ color: '#6060A0', fontSize: isMobile ? '0.7rem' : '0.8rem', marginBottom: isMobile ? 12 : 24, textAlign: 'center', letterSpacing: '0.05em' }}>
        Select your faction to enter the mythic battlefield
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 8 : 12, maxWidth: 900, width: '100%' }}>
        {factions.map(f => (
          <div
            key={f.id}
            className={`faction-card ${selected === f.id ? 'selected' : ''}`}
            onClick={() => { audio.playSfx('button_click'); setSelected(f.id as Faction); }}
            style={{ border: selected === f.id ? `2px solid ${f.colors.accent}` : '2px solid #2A2A3E' }}
          >
            <div style={{ height: isMobile ? 50 : 80, background: `linear-gradient(135deg, ${f.colors.bg} 0%, ${f.colors.primary}33 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <svg width="180" height="80" viewBox="0 0 180 80" style={{ position: 'absolute', inset: 0 }}>
                <defs><linearGradient id={`fg${f.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={f.colors.primary} stopOpacity="0.4" /><stop offset="100%" stopColor={f.colors.secondary} stopOpacity="0.2" /></linearGradient></defs>
                <rect width="180" height="80" fill={`url(#fg${f.id})`} />
                <circle cx="90" cy="40" r="30" fill="none" stroke={f.colors.accent} strokeWidth="0.5" opacity="0.3" />
                <circle cx="90" cy="40" r="20" fill="none" stroke={f.colors.accent} strokeWidth="0.5" opacity="0.3" />
                <circle cx="90" cy="40" r="10" fill={f.colors.accent} opacity="0.08" />
                {[0,1,2,3].map(i => (<line key={i} x1="90" y1="40" x2={90 + Math.cos(i * Math.PI / 2) * 30} y2={40 + Math.sin(i * Math.PI / 2) * 30} stroke={f.colors.accent} strokeWidth="0.5" opacity="0.25" />))}
              </svg>
              <span style={{ position: 'relative', zIndex: 1, fontSize: isMobile ? '1.4rem' : '2rem' }}>{f.emoji}</span>
            </div>
            <div style={{ padding: isMobile ? '6px 8px 8px' : '10px 12px 12px' }}>
              <div className="font-heading" style={{ fontSize: isMobile ? '0.65rem' : '0.8rem', fontWeight: 700, color: f.colors.accent, letterSpacing: '0.05em', marginBottom: 2 }}>{f.name}</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: isMobile ? '0.5rem' : '0.6rem', color: '#6060A0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: isMobile ? 3 : 6 }}>{f.subtitle}</div>
              {!isMobile && <div className="font-body" style={{ fontSize: '0.65rem', color: '#9090B0', lineHeight: 1.4, marginBottom: 8 }}>{f.description}</div>}
              <div style={{ borderTop: '1px solid #2A2A3E', paddingTop: isMobile ? 4 : 8 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: '#604020', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Leader: {f.leaderName}</div>
                {!isMobile && <div className="font-body" style={{ fontSize: '0.62rem', color: '#8070C0', fontStyle: 'italic' }}>{f.leaderAbility}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => { if (selected) { audio.playSfx('button_click'); onSelect(selected); } }}
        disabled={!selected}
        style={{
          marginTop: 24, fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.9rem',
          letterSpacing: '0.2em', textTransform: 'uppercase', padding: '12px 40px',
          border: `2px solid ${selected ? '#C8A040' : '#2A2A3E'}`, borderRadius: 6,
          background: selected ? 'rgba(200,160,64,0.15)' : 'transparent',
          color: selected ? '#F0C84A' : '#404058',
          cursor: selected ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
        }}
      >
        {selected ? `Enter as ${FACTIONS[selected]?.name}` : 'Select a Faction'}
      </button>
      <MuteButton />
    </div>
  );
}

// ============================
// Mulligan Screen
// ============================
function MulliganScreen({ state, onMulligan, onReady }: { state: GameState; onMulligan: (id: string) => void; onReady: () => void }) {
  const [zoomed, setZoomed] = useState<CardInstance | null>(null);

  return (
    <div className="overlay-screen" style={{ padding: 16, background: 'rgba(8,8,16,0.97)', overflowY: 'auto' }}>
      <div className="font-title" style={{ fontSize: '1.3rem', color: '#C8A040', letterSpacing: '0.3em', marginBottom: 6, textAlign: 'center' }}>Opening Hand</div>
      <div className="font-body" style={{ color: '#6060A0', fontSize: '0.75rem', marginBottom: 8, textAlign: 'center' }}>
        {state.mulligansLeft > 0 ? `Click any card to redraw it. Mulligans remaining: ${state.mulligansLeft}` : 'No mulligans remaining.'}
      </div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#503828', marginBottom: 24, textAlign: 'center', letterSpacing: '0.08em' }}>
        Faction: {FACTIONS[state.player.faction]?.name}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 960 }}>
        {state.player.hand.map(card => (
          <div key={card.instanceId} style={{ cursor: 'pointer' }}
            onContextMenu={e => { e.preventDefault(); setZoomed(card); }}
          >
            <CardComponent
              card={card} size="lg"
              onClick={() => { if (state.mulligansLeft > 0) { audio.playSfx('card_play'); onMulligan(card.instanceId); } else setZoomed(card); }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#303040', textAlign: 'center' }}>
        Right-click or hold to zoom a card
      </div>

      <button onClick={() => { audio.playSfx('button_click'); onReady(); }} style={{
        marginTop: 24, fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.9rem',
        letterSpacing: '0.2em', textTransform: 'uppercase', padding: '12px 40px',
        border: '2px solid #C8A040', borderRadius: 6,
        background: 'rgba(200,160,64,0.12)', color: '#F0C84A', cursor: 'pointer',
      }}>
        March to Battle
      </button>

      {zoomed && <CardZoomModal card={zoomed} onClose={() => setZoomed(null)} />}
      <MuteButton />
    </div>
  );
}

// ============================
// Mobile Row Component
// ============================
function MobileBattleRow({ row, label, rowType, isEnemy, isValidDrop, score, hasWeather, weatherClass, onTap, onCardClick, destroyedIds }: {
  row: { units: CardInstance[] }; label: string; rowType: Row;
  isEnemy: boolean; isValidDrop?: boolean; score: number; hasWeather: boolean;
  weatherClass?: string;
  onTap?: () => void;
  onCardClick?: (card: CardInstance) => void;
  destroyedIds?: Set<string>;
}) {
  const color = { close: '#C03030', ranged: '#3080C0', ritual: '#8030C0' }[rowType];
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        minHeight: 42, padding: '2px 0',
        borderRadius: 4,
        background: isValidDrop ? `${color}18` : 'transparent',
        border: isValidDrop ? `1px dashed ${color}80` : '1px solid transparent',
        transition: 'all 0.15s',
        cursor: isValidDrop ? 'pointer' : 'default',
      }}
      onClick={isValidDrop ? onTap : undefined}
    >
      {/* Label + score */}
      <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.42rem', color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', fontWeight: 700, color: hasWeather ? '#80A8E8' : '#F0D080', lineHeight: 1 }}>{score}</div>
        {hasWeather && <div style={{ fontSize: '0.45rem', color: '#80A8E8' }}>❄</div>}
      </div>
      {/* Cards scrollable */}
      <div className={weatherClass || ''} style={{ flex: 1, display: 'flex', gap: 3, overflowX: 'auto', alignItems: 'center', paddingRight: 2, position: 'relative' } as React.CSSProperties}>
        {row.units.map(card => (
          <div
            key={card.instanceId}
            className={destroyedIds?.has(card.instanceId) ? 'card-destroying' : ''}
            onClick={e => { e.stopPropagation(); onCardClick?.(card); }}
            style={{ flexShrink: 0, cursor: 'zoom-in' }}
          >
            <CardComponent card={card} size="sm" style={{ width: 52, height: 78 }} />
          </div>
        ))}
        {row.units.length === 0 && (
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.48rem', color: isValidDrop ? color : '#1E1E2E', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 6px' }}>
            {isValidDrop ? `▶ Play here` : `empty`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================
// Row Component
// ============================
function BattleRow({ row, label, rowType, isEnemy, isValidDrop, score, hasWeather, weatherClass, onPointerEnter, onPointerLeave, onCardClick, destroyedIds }: {
  row: { units: CardInstance[] }; label: string; rowType: Row;
  isEnemy: boolean; isValidDrop: boolean; score: number; hasWeather: boolean;
  weatherClass?: string;
  onPointerEnter?: () => void; onPointerLeave?: () => void;
  onCardClick?: (card: CardInstance) => void;
  destroyedIds?: Set<string>;
}) {
  const color = { close: '#C03030', ranged: '#3080C0', ritual: '#8030C0' }[rowType];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 48, flexShrink: 0 }}>
        <div className="row-label" style={{ color }}>{label}</div>
        <div className="score-badge" style={{ width: 32, height: 32, fontSize: '0.9rem', borderColor: hasWeather ? '#4080C0' : color, color: hasWeather ? '#80A8E8' : '#F0D080', background: `${hasWeather ? 'rgba(64,128,192,0.1)' : `${color}15`}`, position: 'relative' }}>
          {score}
          {hasWeather && <div style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: '#4080C0', border: '1px solid #6090C8', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>❄</div>}
        </div>
      </div>
      <div
        className={`battlefield-row ${rowType}-row ${isValidDrop ? 'valid-drop' : ''} ${weatherClass || ''}`}
        style={{ flex: 1, background: isEnemy ? 'rgba(255,60,60,0.03)' : 'rgba(60,60,255,0.03)', minHeight: 100, overflowX: 'auto', position: 'relative' }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {row.units.map(card => (
          <div
            key={card.instanceId}
            className={destroyedIds?.has(card.instanceId) ? 'card-destroying' : ''}
            onClick={() => onCardClick?.(card)}
            style={{ cursor: 'zoom-in' }}
          >
            <CardComponent card={card} size="sm" />
          </div>
        ))}
        {row.units.length === 0 && (
          <div style={{ width: '100%', textAlign: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#2A2A3A', letterSpacing: '0.1em', textTransform: 'uppercase', userSelect: 'none' }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================
// Battle Screen
// ============================
// Helper: get all card instance IDs currently on both battlefields
function getAllBattlefieldIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  (['close','ranged','ritual'] as Row[]).forEach(row => {
    state.player.battlefield[row].units.forEach(c => ids.add(c.instanceId));
    state.ai.battlefield[row].units.forEach(c => ids.add(c.instanceId));
  });
  return ids;
}

// Helper: get weather overlay class from active weather effects
function getWeatherClass(hasWeather: boolean, rowType: Row): string {
  if (!hasWeather) return '';
  // Map row type to a single overlay style (blizzard covers all cases cleanly)
  const map: Record<Row, string> = {
    close:  'row-weather-blizzard',
    ranged: 'row-weather-rain',
    ritual: 'row-weather-mist',
  };
  return map[rowType] || 'row-weather-blizzard';
}

function BattleScreen({ state, onAction, onSave }: { state: GameState; onAction: (action: any, who: 'player' | 'ai') => void; onSave: () => void }) {
  const isMobile = useIsMobile();
  const [drag, setDrag] = useState<DragState>({ card: null, x: 0, y: 0, startX: 0, startY: 0, active: false });
  const [hoveredRow, setHoveredRow] = useState<Row | null>(null);
  const [hoveredCard, setHoveredCard] = useState<CardInstance | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [aiThinking, setAiThinking] = useState(false);
  const [zoomedCard, setZoomedCard] = useState<CardInstance | null>(null);
  // Mobile tap-to-play: selected card from hand
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Faction tooltip state
  const [showPlayerTooltip, setShowPlayerTooltip] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const playerFactionRef = useRef<HTMLDivElement>(null);
  const aiFactionRef = useRef<HTMLDivElement>(null);

  // Destroyed card tracking — cards that just left the battlefield
  const [destroyedIds, setDestroyedIds] = useState<Set<string>>(new Set());
  const prevBattlefieldIdsRef = useRef<Set<string>>(new Set());

  // Detect removed cards each time state changes
  useEffect(() => {
    const current = getAllBattlefieldIds(state);
    const prev = prevBattlefieldIdsRef.current;
    const removed = new Set<string>();
    prev.forEach(id => { if (!current.has(id)) removed.add(id); });
    if (removed.size > 0) {
      // Add to destroying set temporarily
      setDestroyedIds(d => new Set([...d, ...removed]));
      // Clean up after animation completes (~600ms)
      setTimeout(() => {
        setDestroyedIds(d => {
          const next = new Set(d);
          removed.forEach(id => next.delete(id));
          return next;
        });
      }, 600);
    }
    prevBattlefieldIdsRef.current = current;
  }, [state]);

  const playerFaction = FACTIONS[state.player.faction];
  const aiFaction = FACTIONS[state.ai.faction];
  const playerScore = getTotalScore(state.player.battlefield);
  const aiScore = getTotalScore(state.ai.battlefield);

  // AI turn — use a ref for state so the setTimeout closure always sees the latest state
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // isAiTurn: true when it's genuinely the AI's turn to act.
  // This includes the case where currentTurn switched to 'player' but the player
  // already passed — meaning the AI should keep playing (Gwint rule: if one player
  // passed, the other keeps playing until they also pass or run out of cards).
  const isAiTurn = state.phase === 'battle' &&
    !state.ai.hasPassed &&
    !(state.player.hasPassed && state.ai.hasPassed) &&
    (state.currentTurn === 'ai' || (state.currentTurn === 'player' && state.player.hasPassed));

  useEffect(() => {
    if (!isAiTurn) return;

    let cancelled = false;
    setAiThinking(true);
    const delay = 800 + Math.random() * 600;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const current = stateRef.current;
      // Re-check with current (non-stale) state — same isAiTurn logic
      const stillAiTurn = current.phase === 'battle' &&
        !current.ai.hasPassed &&
        !(current.player.hasPassed && current.ai.hasPassed) &&
        (current.currentTurn === 'ai' || (current.currentTurn === 'player' && current.player.hasPassed));
      if (!stillAiTurn) {
        setAiThinking(false);
        return;
      }
      const action = aiDecide(current);
      if (action.type === 'PLAY_WEATHER') audio.playSfx('weather_play');
      else if (action.type === 'PLAY_SPECIAL') audio.playSfx('card_play');
      else if (action.type !== 'PASS') audio.playSfx('card_play');
      onAction(action, 'ai');
      setAiThinking(false);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setAiThinking(false);
    };
  // Dependencies: isAiTurn (for initial trigger) + currentTurn (re-fires each card play even
  // when isAiTurn stays true, e.g. player passed so AI keeps getting the turn back)
  }, [isAiTurn, state.currentTurn]);

  // Clear selected card when turn changes
  useEffect(() => { setSelectedCard(null); }, [state.currentTurn]);

  // Pointer move for drag (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handleMove = (e: PointerEvent) => { if (!drag.active) return; setDrag(d => ({ ...d, x: e.clientX, y: e.clientY })); };
    const handleUp = () => {
      if (!drag.active || !drag.card) return;
      if (hoveredRow && drag.card.def.row === hoveredRow && drag.card.def.type === 'unit') {
        audio.playSfx('card_play');
        onAction({ type: 'PLAY_UNIT', cardInstanceId: drag.card.instanceId, row: hoveredRow }, 'player');
      } else if (drag.card.def.type === 'weather' && hoveredRow) {
        audio.playSfx('weather_play');
        onAction({ type: 'PLAY_WEATHER', cardInstanceId: drag.card.instanceId }, 'player');
      } else if (drag.card.def.type === 'special' && hoveredRow) {
        audio.playSfx('card_play');
        onAction({ type: 'PLAY_SPECIAL', cardInstanceId: drag.card.instanceId, targetRow: hoveredRow }, 'player');
      }
      setDrag({ card: null, x: 0, y: 0, startX: 0, startY: 0, active: false });
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
  }, [drag.active, drag.card, hoveredRow, isMobile]);

  const handleCardDragStart = (e: React.PointerEvent, card: CardInstance) => {
    if (isMobile || state.currentTurn !== 'player') return;
    e.preventDefault();
    setDrag({ card, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: true });
    setHoveredCard(null);
  };

  // Mobile: tap card in hand to select/deselect
  const handleMobileTapCard = (card: CardInstance) => {
    if (state.currentTurn !== 'player') return;
    if (selectedCard?.instanceId === card.instanceId) {
      setSelectedCard(null); // deselect
    } else {
      audio.playSfx('card_hover');
      setSelectedCard(card);
    }
  };

  // Mobile: tap row to play selected card
  const handleMobileTapRow = (row: Row) => {
    if (!selectedCard || state.currentTurn !== 'player') return;
    if (selectedCard.def.type === 'unit') {
      if (selectedCard.def.row !== row) return; // wrong row
      audio.playSfx('card_play');
      onAction({ type: 'PLAY_UNIT', cardInstanceId: selectedCard.instanceId, row }, 'player');
      setSelectedCard(null);
    } else if (selectedCard.def.type === 'weather') {
      audio.playSfx('weather_play');
      onAction({ type: 'PLAY_WEATHER', cardInstanceId: selectedCard.instanceId }, 'player');
      setSelectedCard(null);
    } else if (selectedCard.def.type === 'special') {
      audio.playSfx('card_play');
      onAction({ type: 'PLAY_SPECIAL', cardInstanceId: selectedCard.instanceId, targetRow: row }, 'player');
      setSelectedCard(null);
    }
  };

  const isValidRow = (row: Row): boolean => {
    if (!drag.card || !drag.active) return false;
    if (drag.card.def.type === 'unit') return drag.card.def.row === row;
    return drag.card.def.type === 'weather' || drag.card.def.type === 'special';
  };

  const isMobileValidRow = (row: Row): boolean => {
    if (!selectedCard) return false;
    if (selectedCard.def.type === 'unit') return selectedCard.def.row === row;
    return selectedCard.def.type === 'weather' || selectedCard.def.type === 'special';
  };

  const handleCardHover = (e: React.MouseEvent, card: CardInstance) => {
    if (drag.active || isMobile) return;
    setHoveredCard(card);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handlePass = () => { audio.playSfx('pass_turn'); onAction({ type: 'PASS' }, 'player'); };
  const handleLeader = () => { audio.playSfx('button_click'); onAction({ type: 'USE_LEADER' }, 'player'); };

  const bg = playerFaction?.colors.bg || '#080810';
  const canPlay = state.currentTurn === 'player' && !state.player.hasPassed;

  // ─── MOBILE LAYOUT ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div ref={containerRef} style={{ width: '100vw', height: '100dvh', background: `radial-gradient(ellipse at 50% 30%, ${bg}88 0%, #080810 70%)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>

        {/* Compact mobile header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #1A1A2E', background: 'rgba(8,8,16,0.9)', flexShrink: 0, gap: 4 }}>
          {/* AI side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            <div className="score-badge" style={{ width: 28, height: 28, fontSize: '0.85rem', background: aiScore > playerScore ? 'rgba(200,50,50,0.15)' : 'rgba(8,8,16,0.8)', borderColor: aiScore > playerScore ? '#C03030' : '#404058' }}>{aiScore}</div>
            <div>
              <div
                ref={aiFactionRef as React.RefObject<HTMLDivElement>}
                onMouseEnter={() => setShowAiTooltip(true)}
                onMouseLeave={() => setShowAiTooltip(false)}
                style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#C03030', cursor: 'help', userSelect: 'none' }}
              >{aiFaction?.name}</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
                {state.roundWinners.map((w, i) => (<div key={i} className={`round-gem ${w === 'ai' ? 'won' : w === 'player' ? 'lost' : 'draw'}`} style={{ width: 6, height: 6 }} />))}
                {Array.from({ length: Math.max(0, 2 - state.roundWinners.filter(w => w === 'ai').length) }).map((_, i) => (<div key={`ea${i}`} className="round-gem" style={{ width: 6, height: 6 }} />))}
              </div>
            </div>
          </div>
          {/* Center */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: '#604020', letterSpacing: '0.15em' }}>R{state.round}/3</div>
            <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 2 }}>
              {state.weatherEffects.close && <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.42rem', padding: '1px 3px', borderRadius: 2, border: '1px solid #C03030', color: '#C06060' }}>C❄</span>}
              {state.weatherEffects.ranged && <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.42rem', padding: '1px 3px', borderRadius: 2, border: '1px solid #3080C0', color: '#6090C0' }}>R❄</span>}
              {state.weatherEffects.ritual && <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.42rem', padding: '1px 3px', borderRadius: 2, border: '1px solid #8030C0', color: '#9060C0' }}>Ri❄</span>}
            </div>
            <button onClick={() => { audio.playSfx('button_click'); onSave(); }} style={{ marginTop: 2, fontFamily: 'Cinzel, serif', fontSize: '0.42rem', padding: '1px 5px', border: '1px solid #2A2A3E', borderRadius: 2, background: 'transparent', color: '#404060', cursor: 'pointer' }}>💾</button>
          </div>
          {/* Player side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'right' }}>
              <div
                ref={playerFactionRef as React.RefObject<HTMLDivElement>}
                onMouseEnter={() => setShowPlayerTooltip(true)}
                onMouseLeave={() => setShowPlayerTooltip(false)}
                style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#C8A040', cursor: 'help', userSelect: 'none' }}
              >{playerFaction?.name}</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 1, justifyContent: 'flex-end' }}>
                {state.roundWinners.map((w, i) => (<div key={i} className={`round-gem ${w === 'player' ? 'won' : w === 'ai' ? 'lost' : 'draw'}`} style={{ width: 6, height: 6 }} />))}
                {Array.from({ length: Math.max(0, 2 - state.roundWinners.filter(w => w === 'player').length) }).map((_, i) => (<div key={`ep${i}`} className="round-gem" style={{ width: 6, height: 6 }} />))}
              </div>
            </div>
            <div className="score-badge" style={{ width: 28, height: 28, fontSize: '0.85rem', background: playerScore >= aiScore ? 'rgba(200,160,64,0.15)' : 'rgba(8,8,16,0.8)', borderColor: playerScore >= aiScore ? '#C8A040' : '#404058' }}>{playerScore}</div>
          </div>
        </div>

        {/* Selection hint bar */}
        {selectedCard && (
          <div style={{ background: 'rgba(200,160,64,0.12)', borderBottom: '1px solid #C8A04040', padding: '3px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#C8A040' }}>
              ⚔ {selectedCard.def.name} — tap your {selectedCard.def.type === 'unit' ? `${selectedCard.def.row} row` : 'any row'} to play
            </div>
            <button onClick={() => setSelectedCard(null)} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: '#604040', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* AI Battlefield (compact, scrollable-x) */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 1, padding: '2px 6px', borderBottom: '1px solid rgba(200,50,50,0.15)', background: 'rgba(30,8,8,0.3)' }}>
          {(['ritual','ranged','close'] as Row[]).map(row => (
            <MobileBattleRow key={row} row={(state.ai.battlefield as any)[row]} label={row} rowType={row} isEnemy={true} hasWeather={(state.weatherEffects as any)[row]} weatherClass={getWeatherClass((state.weatherEffects as any)[row], row)} score={getRowScore((state.ai.battlefield as any)[row])} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #C8A04060, #C8A040, #C8A04060, transparent)', flexShrink: 0 }} />

        {/* Player Battlefield */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 1, padding: '2px 6px', borderBottom: '1px solid rgba(64,64,255,0.12)', background: 'rgba(8,8,30,0.3)' }}>
          {(['close','ranged','ritual'] as Row[]).map(row => (
            <MobileBattleRow key={row} row={(state.player.battlefield as any)[row]} label={row} rowType={row} isEnemy={false} hasWeather={(state.weatherEffects as any)[row]} weatherClass={getWeatherClass((state.weatherEffects as any)[row], row)} score={getRowScore((state.player.battlefield as any)[row])}
              isValidDrop={isMobileValidRow(row)}
              onTap={() => handleMobileTapRow(row)}
              onCardClick={setZoomedCard}
              destroyedIds={destroyedIds}
            />
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* Hand + controls */}
        <div style={{ borderTop: '1px solid #1A1A2E', background: 'rgba(8,8,16,0.95)', padding: '4px 8px 8px', flexShrink: 0 }}>
          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <button className="pass-button" onClick={handlePass} disabled={!canPlay} style={{ opacity: canPlay ? 1 : 0.4, cursor: canPlay ? 'pointer' : 'not-allowed', padding: '4px 10px', fontSize: '0.6rem' }}>
              {state.player.hasPassed ? 'Passed' : 'Pass'}
            </button>
            {!state.player.leaderUsed && (
              <button onClick={handleLeader} disabled={!canPlay} style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px', border: `1px solid ${playerFaction?.colors.accent || '#C8A040'}`, borderRadius: 4, background: `${playerFaction?.colors.accent || '#C8A040'}18`, color: playerFaction?.colors.accent || '#C8A040', cursor: canPlay ? 'pointer' : 'not-allowed', opacity: canPlay ? 1 : 0.4 }}>
                Leader
              </button>
            )}
            {aiThinking && <div className="ai-thinking" style={{ fontSize: '0.6rem' }}><span>●</span><span>●</span><span>●</span></div>}
            {!canPlay && !state.player.hasPassed && !aiThinking && (
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: '#604040', letterSpacing: '0.05em' }}>Opponent's turn…</div>
            )}
          </div>
          {/* Hand grid — wraps to multiple rows so all cards visible on iPhone */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 2, justifyContent: 'flex-start' }}>
            {state.player.hand.map(card => (
              <div key={card.instanceId}
                onClick={() => handleMobileTapCard(card)}
                onContextMenu={e => { e.preventDefault(); setZoomedCard(card); }}
                style={{ position: 'relative', outline: selectedCard?.instanceId === card.instanceId ? `2px solid #C8A040` : 'none', borderRadius: 6, boxShadow: selectedCard?.instanceId === card.instanceId ? '0 0 14px rgba(200,160,64,0.7)' : 'none' }}
              >
                <CardComponent
                  card={card} size="sm"
                  style={{ width: 60, height: 90, opacity: !canPlay ? 0.5 : 1 }}
                />
              </div>
            ))}
            {state.player.hand.length === 0 && (
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: '#2A2A3A', padding: '8px 0' }}>No cards in hand</div>
            )}
          </div>
        </div>

        {zoomedCard && <CardZoomModal card={zoomedCard} onClose={() => setZoomedCard(null)} />}
        <EventNotificationBanner events={state.events || []} />
        {showAiTooltip && aiFaction && <FactionTooltip factionId={state.ai.faction} anchorRef={aiFactionRef} side="left" />}
        {showPlayerTooltip && playerFaction && <FactionTooltip factionId={state.player.faction} anchorRef={playerFactionRef} side="right" />}
        <MuteButton />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', background: `radial-gradient(ellipse at 50% 100%, ${bg}88 0%, #080810 70%)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #1A1A2E', background: 'rgba(8,8,16,0.8)', flexShrink: 0 }}>
        {/* AI info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
          <div style={{ textAlign: 'right' }}>
            <div
              ref={aiFactionRef as React.RefObject<HTMLDivElement>}
              className="font-heading"
              onMouseEnter={() => setShowAiTooltip(true)}
              onMouseLeave={() => setShowAiTooltip(false)}
              style={{ fontSize: '0.7rem', color: '#C03030', letterSpacing: '0.1em', cursor: 'help', userSelect: 'none' }}
            >{aiFaction?.name}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#604040', letterSpacing: '0.05em' }}>Hand: {state.ai.hand.length} · Deck: {state.ai.deck.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {state.roundWinners.map((w, i) => (<div key={i} className={`round-gem ${w === 'ai' ? 'won' : w === 'player' ? 'lost' : 'draw'}`} />))}
            {Array.from({ length: Math.max(0, 2 - state.roundWinners.filter(w => w === 'ai').length) }).map((_, i) => (<div key={`ea${i}`} className="round-gem" />))}
          </div>
          <div className="score-badge" style={{ background: aiScore > playerScore ? 'rgba(200,50,50,0.15)' : 'rgba(8,8,16,0.8)', borderColor: aiScore > playerScore ? '#C03030' : '#404058', fontSize: '1rem' }}>{aiScore}</div>
        </div>

        {/* Center */}
        <div style={{ textAlign: 'center' }}>
          <div className="font-heading" style={{ fontSize: '0.6rem', color: '#604020', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Round {state.round} / 3</div>
          <div className="font-body" style={{ fontSize: '0.6rem', color: '#4A4A6A', fontStyle: 'italic', maxWidth: 200, textAlign: 'center' }}>{state.lastAction || ''}</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 2 }}>
            {state.weatherEffects.close && <div className="weather-indicator" style={{ borderColor: '#C03030', color: '#C06060', background: 'rgba(192,48,48,0.1)' }}>Close ❄</div>}
            {state.weatherEffects.ranged && <div className="weather-indicator" style={{ borderColor: '#3080C0', color: '#6090C0', background: 'rgba(48,128,192,0.1)' }}>Ranged ❄</div>}
            {state.weatherEffects.ritual && <div className="weather-indicator" style={{ borderColor: '#8030C0', color: '#9060C0', background: 'rgba(128,48,192,0.1)' }}>Ritual ❄</div>}
          </div>
          {/* Save button */}
          <button onClick={() => { audio.playSfx('button_click'); onSave(); }} style={{
            marginTop: 4, fontFamily: 'Cinzel, serif', fontSize: '0.52rem', letterSpacing: '0.1em',
            padding: '2px 8px', border: '1px solid #2A2A3E', borderRadius: 3,
            background: 'transparent', color: '#404060', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#C8A040'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#C8A04060'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#404060'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2A2A3E'; }}
          >
            💾 Save & Exit
          </button>
        </div>

        {/* Player info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180, justifyContent: 'flex-end' }}>
          <div className="score-badge" style={{ background: playerScore >= aiScore ? 'rgba(200,160,64,0.15)' : 'rgba(8,8,16,0.8)', borderColor: playerScore >= aiScore ? '#C8A040' : '#404058', fontSize: '1rem' }}>{playerScore}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {state.roundWinners.map((w, i) => (<div key={i} className={`round-gem ${w === 'player' ? 'won' : w === 'ai' ? 'lost' : 'draw'}`} />))}
            {Array.from({ length: Math.max(0, 2 - state.roundWinners.filter(w => w === 'player').length) }).map((_, i) => (<div key={`ep${i}`} className="round-gem" />))}
          </div>
          <div>
            <div
              ref={playerFactionRef as React.RefObject<HTMLDivElement>}
              className="font-heading"
              onMouseEnter={() => setShowPlayerTooltip(true)}
              onMouseLeave={() => setShowPlayerTooltip(false)}
              style={{ fontSize: '0.7rem', color: '#C8A040', letterSpacing: '0.1em', cursor: 'help', userSelect: 'none' }}
            >{playerFaction?.name}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: '#604020', letterSpacing: '0.05em' }}>Hand: {state.player.hand.length} · Deck: {state.player.deck.length}</div>
          </div>
        </div>
      </div>

      {/* Battlefield */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 8px', gap: 0, overflow: 'hidden', minHeight: 0 }}>
        {/* AI side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, paddingBottom: 4, overflowY: 'auto' }}>
          <BattleRow row={state.ai.battlefield.ritual} label="Ritual" rowType="ritual" isEnemy hasWeather={state.weatherEffects.ritual} weatherClass={getWeatherClass(state.weatherEffects.ritual, 'ritual')} isValidDrop={false} score={getRowScore(state.ai.battlefield.ritual)} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
          <BattleRow row={state.ai.battlefield.ranged} label="Ranged" rowType="ranged" isEnemy hasWeather={state.weatherEffects.ranged} weatherClass={getWeatherClass(state.weatherEffects.ranged, 'ranged')} isValidDrop={false} score={getRowScore(state.ai.battlefield.ranged)} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
          <BattleRow row={state.ai.battlefield.close} label="Close" rowType="close" isEnemy hasWeather={state.weatherEffects.close} weatherClass={getWeatherClass(state.weatherEffects.close, 'close')} isValidDrop={false} score={getRowScore(state.ai.battlefield.close)} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
        </div>

        {/* Center divider — clearly separates the two sides */}
        <div style={{ flexShrink: 0, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #C8A04030)' }} />
          <div style={{ height: 6, width: '60%', background: 'linear-gradient(90deg, transparent, #C8A04070, #C8A040CC, #C8A04070, transparent)', borderRadius: 3, boxShadow: '0 0 12px rgba(200,160,64,0.35), 0 0 4px rgba(200,160,64,0.6)' }} />
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #C8A04030, transparent)' }} />
        </div>

        {/* Player side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, paddingTop: 4, overflowY: 'auto' }}>
          <BattleRow row={state.player.battlefield.close} label="Close" rowType="close" isEnemy={false} hasWeather={state.weatherEffects.close} weatherClass={getWeatherClass(state.weatherEffects.close, 'close')} isValidDrop={isValidRow('close') || (drag.active && (drag.card?.def.type === 'weather' || drag.card?.def.type === 'special'))} score={getRowScore(state.player.battlefield.close)} onPointerEnter={() => setHoveredRow('close')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
          <BattleRow row={state.player.battlefield.ranged} label="Ranged" rowType="ranged" isEnemy={false} hasWeather={state.weatherEffects.ranged} weatherClass={getWeatherClass(state.weatherEffects.ranged, 'ranged')} isValidDrop={isValidRow('ranged') || (drag.active && (drag.card?.def.type === 'weather' || drag.card?.def.type === 'special'))} score={getRowScore(state.player.battlefield.ranged)} onPointerEnter={() => setHoveredRow('ranged')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
          <BattleRow row={state.player.battlefield.ritual} label="Ritual" rowType="ritual" isEnemy={false} hasWeather={state.weatherEffects.ritual} weatherClass={getWeatherClass(state.weatherEffects.ritual, 'ritual')} isValidDrop={isValidRow('ritual') || (drag.active && (drag.card?.def.type === 'weather' || drag.card?.def.type === 'special'))} score={getRowScore(state.player.battlefield.ritual)} onPointerEnter={() => setHoveredRow('ritual')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} destroyedIds={destroyedIds} />
        </div>
      </div>

      {/* Hand + controls */}
      <div style={{ borderTop: '1px solid #1A1A2E', background: 'rgba(8,8,16,0.9)', padding: '4px 12px 6px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <button className="pass-button" onClick={handlePass} disabled={state.currentTurn !== 'player' || state.player.hasPassed} style={{ opacity: (state.currentTurn !== 'player' || state.player.hasPassed) ? 0.4 : 1, cursor: (state.currentTurn !== 'player' || state.player.hasPassed) ? 'not-allowed' : 'pointer' }}>
            {state.player.hasPassed ? 'Passed' : 'Pass'}
          </button>
          {!state.player.leaderUsed && (
            <button onClick={handleLeader} disabled={state.currentTurn !== 'player'} style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 10px', border: `1px solid ${playerFaction?.colors.accent || '#C8A040'}`, borderRadius: 4, background: `${playerFaction?.colors.accent || '#C8A040'}18`, color: playerFaction?.colors.accent || '#C8A040', cursor: state.currentTurn !== 'player' ? 'not-allowed' : 'pointer', opacity: state.currentTurn !== 'player' ? 0.4 : 1 }}>
              Leader
            </button>
          )}
          {aiThinking && <div className="ai-thinking"><span>●</span><span>●</span><span>●</span></div>}
        </div>

        <div className="hand-area" style={{ flex: 1 }}>
          {state.player.hand.map(card => (
            <div key={card.instanceId}
              onMouseEnter={e => handleCardHover(e, card)}
              onMouseLeave={() => setHoveredCard(null)}
              onContextMenu={e => { e.preventDefault(); setZoomedCard(card); }}
              style={{ position: 'relative', zIndex: drag.card?.instanceId === card.instanceId ? 1000 : undefined }}
            >
              <CardComponent
                card={card} size="md"
                onDragStart={handleCardDragStart}
                dragging={drag.card?.instanceId === card.instanceId && drag.active}
                style={{ opacity: state.currentTurn !== 'player' ? 0.5 : 1, visibility: (drag.card?.instanceId === card.instanceId && drag.active) ? 'hidden' : 'visible' }}
              />
            </div>
          ))}
          {state.player.hand.length === 0 && (
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#2A2A3A', letterSpacing: '0.1em', margin: 'auto' }}>No cards in hand</div>
          )}
        </div>
      </div>

      {/* Drag ghost */}
      {drag.active && drag.card && (
        <div className="card-preview-tooltip" style={{ left: drag.x - CARD_DIMS.md.w / 2, top: drag.y - CARD_DIMS.md.h / 2 }}>
          <CardComponent card={drag.card} size="md" style={{ cursor: 'grabbing' }} />
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredCard && !drag.active && (
        <div className="card-preview-tooltip" style={{ left: Math.min(tooltipPos.x + 16, window.innerWidth - 210), top: Math.max(tooltipPos.y - 240, 10) }}>
          <div style={{ background: '#0E0E1A', border: '1px solid #C8A04060', borderRadius: 8, padding: 10, width: 200, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <CardArt artKey={hoveredCard.def.artKey} width={180} height={120} style={{ borderRadius: 4, marginBottom: 8, display: 'block' }} />
            <div className="font-heading" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E8D080', marginBottom: 3 }}>{hoveredCard.def.name}</div>
            <div className="font-body" style={{ fontSize: '0.65rem', color: '#9090B0', lineHeight: 1.4, marginBottom: 6, fontStyle: 'italic' }}>{hoveredCard.def.description}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {hoveredCard.def.row && <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(200,160,64,0.1)', border: '1px solid #C8A04040', color: '#C8A040' }}>{hoveredCard.def.row}</span>}
              {hoveredCard.def.ability !== 'none' && <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.5rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(160,100,200,0.1)', border: '1px solid #A060C040', color: '#A060C0' }}>{hoveredCard.def.ability}</span>}
            </div>
            <div style={{ marginTop: 6, fontFamily: 'Cinzel, serif', fontSize: '0.5rem', color: '#303040' }}>Right-click to zoom</div>
          </div>
        </div>
      )}

      {zoomedCard && <CardZoomModal card={zoomedCard} onClose={() => setZoomedCard(null)} />}
      <EventNotificationBanner events={state.events || []} />
      {showAiTooltip && aiFaction && <FactionTooltip factionId={state.ai.faction} anchorRef={aiFactionRef} side="left" />}
      {showPlayerTooltip && playerFaction && <FactionTooltip factionId={state.player.faction} anchorRef={playerFactionRef} side="right" />}
      <MuteButton />
    </div>
  );
}

// ============================
// Game Over Screen
// ============================
function GameOverScreen({ state, onRematch, onChangeFaction }: { state: GameState; onRematch: () => void; onChangeFaction: () => void }) {
  const victory = state.winner === 'player';
  const draw = state.winner === 'draw';
  const headline = victory ? 'The gods remember your name.' : draw ? 'Even the gods hesitate.' : 'Fate has weighed your army and found it wanting.';
  const playerWins = state.roundWinners.filter(w => w === 'player').length;
  const aiWins = state.roundWinners.filter(w => w === 'ai').length;

  return (
    <div className="overlay-screen" style={{ background: 'rgba(8,8,16,0.97)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: victory ? 'linear-gradient(90deg, transparent, #C8A040, transparent)' : draw ? 'linear-gradient(90deg, transparent, #808080, transparent)' : 'linear-gradient(90deg, transparent, #C03030, transparent)' }} />
      <div style={{ textAlign: 'center', zIndex: 1, padding: '0 40px' }}>
        <div style={{ display: 'inline-flex', padding: '6px 24px', borderRadius: 4, border: `1px solid ${victory ? '#C8A040' : draw ? '#808080' : '#C03030'}`, background: victory ? 'rgba(200,160,64,0.08)' : draw ? 'rgba(128,128,128,0.08)' : 'rgba(192,48,48,0.08)', marginBottom: 12 }}>
          <div className="font-heading" style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: victory ? '#C8A040' : draw ? '#808080' : '#C03030' }}>{victory ? 'Victory' : draw ? 'Draw' : 'Defeat'}</div>
        </div>
        <div className="font-title" style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '0.15em', color: victory ? '#F0C84A' : draw ? '#C0C0C0' : '#E05050', textShadow: `0 0 30px ${victory ? 'rgba(200,160,64,0.5)' : draw ? 'rgba(128,128,128,0.3)' : 'rgba(200,48,48,0.5)'}`, marginBottom: 8 }}>
          {victory ? 'TRIUMPH' : draw ? 'STANDOFF' : 'FALLEN'}
        </div>
        <div className="font-body" style={{ fontSize: '0.9rem', fontStyle: 'italic', color: '#8080A0', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>"{headline}"</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
          {state.roundWinners.map((w, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div className="font-heading" style={{ fontSize: '0.6rem', color: '#404060', letterSpacing: '0.15em', marginBottom: 6 }}>Round {i + 1}</div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.75rem', background: w === 'player' ? 'rgba(200,160,64,0.15)' : w === 'ai' ? 'rgba(192,48,48,0.15)' : 'rgba(128,128,128,0.15)', border: `2px solid ${w === 'player' ? '#C8A040' : w === 'ai' ? '#C03030' : '#808080'}`, color: w === 'player' ? '#F0C84A' : w === 'ai' ? '#E05050' : '#C0C0C0' }}>
                {w === 'player' ? 'W' : w === 'ai' ? 'L' : 'D'}
              </div>
            </div>
          ))}
        </div>
        <div className="font-body" style={{ fontSize: '0.75rem', color: '#504860', marginBottom: 32, letterSpacing: '0.05em' }}>{FACTIONS[state.player.faction]?.name} vs {FACTIONS[state.ai.faction]?.name}{' · '}{playerWins} – {aiWins}</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button onClick={() => { audio.playSfx('button_click'); onRematch(); }} style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', padding: '12px 36px', border: '2px solid #C8A040', borderRadius: 6, background: 'rgba(200,160,64,0.12)', color: '#F0C84A', cursor: 'pointer' }}>Rematch</button>
          <button onClick={() => { audio.playSfx('button_click'); onChangeFaction(); }} style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '12px 32px', border: '1px solid #404058', borderRadius: 6, background: 'transparent', color: '#8888A8', cursor: 'pointer' }}>Change Faction</button>
        </div>
      </div>
      <MuteButton />
    </div>
  );
}

// ============================
// Card Gallery Screen
// ============================
function GalleryScreen({ onBack }: { onBack: () => void }) {
  const [filterFaction, setFilterFaction] = useState<string>('all');
  const [filterRow, setFilterRow] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [zoomedCard, setZoomedCard] = useState<CardInstance | null>(null);

  const factions = ['all', 'hellenic', 'vedic', 'norse', 'slavic', 'celtic', 'egyptian', 'neutral'];
  const rows = ['all', 'close', 'ranged', 'ritual'];

  const filtered = ALL_CARDS.filter(c => {
    if (filterFaction !== 'all' && c.faction !== filterFaction) return false;
    if (filterRow !== 'all' && c.row !== filterRow) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fakeDef = (c: typeof ALL_CARDS[0]): CardInstance => ({
    instanceId: c.id, def: c, currentStrength: c.strength, isWeatherReduced: false, isCommanderDoubled: false,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080810', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1A1A2E', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button onClick={() => { audio.playSfx('button_click'); onBack(); }} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 16px', border: '1px solid #404058', borderRadius: 4, background: 'transparent', color: '#8888A8', cursor: 'pointer' }}>← Back</button>
        <div className="font-title" style={{ fontSize: '1rem', color: '#C8A040', letterSpacing: '0.25em' }}>Card Gallery</div>
        <div style={{ marginLeft: 'auto', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#404060' }}>{filtered.length} cards</div>
      </div>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1A1A2E', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..." style={{ fontFamily: 'IM Fell English, serif', fontSize: '0.75rem', padding: '4px 10px', borderRadius: 4, border: '1px solid #2A2A3E', background: '#14141E', color: '#D0D0E8', outline: 'none', width: 140 }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {factions.map(f => (<button key={f} className={`filter-chip ${filterFaction === f ? 'active' : ''}`} onClick={() => setFilterFaction(f)}>{f === 'all' ? 'All Factions' : FACTIONS[f]?.name || f}</button>))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {rows.map(r => (<button key={r} className={`filter-chip ${filterRow === r ? 'active' : ''}`} onClick={() => setFilterRow(r)}>{r === 'all' ? 'All Rows' : r}</button>))}
        </div>
      </div>
      <div className="scrollable" style={{ flex: 1, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignContent: 'flex-start' }}>
        {filtered.map(c => (
          <div key={c.id} onClick={() => setZoomedCard(fakeDef(c))} style={{ cursor: 'zoom-in' }}>
            <CardComponent card={fakeDef(c)} size="md" />
          </div>
        ))}
        {filtered.length === 0 && <div style={{ width: '100%', textAlign: 'center', fontFamily: 'Cinzel, serif', color: '#2A2A3A', fontSize: '0.8rem', marginTop: 40 }}>No cards match your filters</div>}
      </div>
      {zoomedCard && <CardZoomModal card={zoomedCard} onClose={() => setZoomedCard(null)} />}
      <MuteButton />
    </div>
  );
}

// ============================
// Main App
// ============================
export default function App() {
  const [phase, setPhase] = useState<GamePhase | 'transition'>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  // Check for saved game
  useEffect(() => { setHasSave(!!loadSavedGame()); }, []);

  // Start audio on first interaction
  useEffect(() => {
    const unlock = async () => {
      await audio.resume();
      await audio.playMusic('title');
      await audio.preload();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }, []);

  // Switch music based on phase
  useEffect(() => {
    if (phase === 'battle') audio.playMusic('battle');
    else if (phase === 'title' || phase === 'faction-select' || phase === 'mulligan' || phase === 'gallery' || phase === 'game-over') audio.playMusic('title');
  }, [phase]);

  // Play fanfare on game over
  useEffect(() => {
    if (phase === 'game-over' && gameState) {
      setTimeout(() => {
        if (gameState.winner === 'player') audio.playSfx('victory_fanfare');
        else audio.playSfx('defeat_sting');
      }, 600);
    }
  }, [phase]);

  const handleSelectFaction = (faction: Faction) => {
    setSelectedFaction(faction);
    const allFactions: Faction[] = ['hellenic', 'vedic', 'norse', 'slavic', 'celtic', 'egyptian'];
    const aiFaction = allFactions[Math.floor(Math.random() * allFactions.length)];
    const state = createInitialState(faction, aiFaction);
    setGameState(state);
    setPhase('transition');
  };

  const handleAction = useCallback((action: any, who: 'player' | 'ai') => {
    setGameState(prev => {
      if (!prev) return prev;
      // Ignore AI actions if AI already passed
      if (who === 'ai' && prev.ai.hasPassed && action.type !== 'END_MULLIGAN') return prev;
      // Ignore AI actions when it's not the AI's turn AND player hasn't passed yet
      // (if player has passed, AI is allowed to act even when currentTurn === 'player')
      if (who === 'ai' && prev.currentTurn !== 'ai' && !prev.player.hasPassed) return prev;
      let next = applyAction(prev, action, who);
      // Auto-pass any player whose hand is empty and hasn't passed yet
      if (!next.player.hasPassed && next.player.hand.length === 0 && next.phase === 'battle') {
        next = applyAction(next, { type: 'PASS' }, 'player');
      }
      if (!next.ai.hasPassed && next.ai.hand.length === 0 && next.phase === 'battle') {
        next = applyAction(next, { type: 'PASS' }, 'ai');
      }
      // Trigger round end when both have passed
      if (next.player.hasPassed && next.ai.hasPassed) {
        next = checkRoundEnd(next);
      }
      return next;
    });
  }, []);

  const handleMulligan = (id: string) => handleAction({ type: 'MULLIGAN', cardInstanceId: id }, 'player');
  const handleEndMulligan = () => handleAction({ type: 'END_MULLIGAN' }, 'player');

  const handleRematch = () => {
    if (!selectedFaction) return;
    const allFactions: Faction[] = ['hellenic', 'vedic', 'norse', 'slavic', 'celtic', 'egyptian'];
    const aiFaction = allFactions[Math.floor(Math.random() * allFactions.length)];
    clearSave(); setHasSave(false);
    const state = createInitialState(selectedFaction, aiFaction);
    setGameState(state);
    setPhase('mulligan');
  };

  const handleChangeFaction = () => { clearSave(); setHasSave(false); setPhase('faction-select'); setGameState(null); };

  const handleSave = () => {
    if (gameState) {
      saveGame(gameState);
      setHasSave(true);
      setSaveNotice('Game saved!');
      setTimeout(() => setSaveNotice(''), 2200);
      setPhase('title');
    }
  };

  const handleLoadSave = () => {
    const saved = loadSavedGame();
    if (saved) {
      setGameState(saved);
      setSelectedFaction(saved.player.faction);
      setPhase('battle');
    }
  };

  // Sync phase from game state
  useEffect(() => {
    if (gameState?.phase === 'game-over' && phase !== 'game-over') { clearSave(); setHasSave(false); setPhase('game-over'); }
    if (gameState?.phase === 'battle' && phase === 'mulligan') setPhase('battle');
  }, [gameState?.phase]);

  return (
    <>
      <div className="game-container" style={{ width: '100vw', height: '100vh', background: '#080810' }}>
        {phase === 'title' && (
          <TitleScreen onPlay={() => setPhase('faction-select')} onGallery={() => setPhase('gallery')} hasSave={hasSave} onLoadSave={handleLoadSave} />
        )}
        {phase === 'faction-select' && <FactionSelectScreen onSelect={handleSelectFaction} />}
        {phase === 'transition' && <CinematicTransition onDone={() => setPhase('mulligan')} />}
        {phase === 'mulligan' && gameState && <MulliganScreen state={gameState} onMulligan={handleMulligan} onReady={handleEndMulligan} />}
        {phase === 'battle' && gameState && <BattleScreen state={gameState} onAction={handleAction} onSave={handleSave} />}
        {phase === 'game-over' && gameState && <GameOverScreen state={gameState} onRematch={handleRematch} onChangeFaction={handleChangeFaction} />}
        {phase === 'gallery' && <GalleryScreen onBack={() => setPhase('title')} />}

        {/* Save notice toast */}
        {saveNotice && (
          <div style={{
            position: 'fixed', bottom: 60, right: 16, zIndex: 9999,
            padding: '8px 16px', borderRadius: 6,
            background: 'rgba(14,20,14,0.95)', border: '1px solid #406040',
            fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#80C080',
            animation: 'fadeIn 0.2s ease',
          }}>
            {saveNotice}
          </div>
        )}
      </div>
    </>
  );
}
