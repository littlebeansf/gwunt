import React, { useState } from 'react';

// Card art component — loads real AI-generated images with SVG procedural fallback
// Weather cards get animated CSS overlays on top of their art

interface ArtProps {
  artKey: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  weatherType?: string; // if set, renders weather animation overlay
  onLoad?: () => void;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRand(seed: number, idx: number): number {
  const x = Math.sin(seed + idx) * 10000;
  return x - Math.floor(x);
}

// Faction color palettes
const FACTION_PALETTES: Record<string, { bg: string[]; fg: string[]; accent: string; glow: string }> = {
  hel: { bg: ['#0A0C1A', '#151828', '#1A2030'], fg: ['#C8A040', '#E8D080', '#8090B0'], accent: '#C8A040', glow: '#FFD06040' },
  ved: { bg: ['#1A0C08', '#281810', '#301818'], fg: ['#E8602A', '#FFB040', '#D06030'], accent: '#E8A030', glow: '#FF802040' },
  nor: { bg: ['#080C18', '#0C1020', '#101828'], fg: ['#4080C0', '#80C0E8', '#C0D0E0'], accent: '#60A8E0', glow: '#4080C040' },
  slv: { bg: ['#080C08', '#0A100A', '#081008'], fg: ['#40A040', '#80C060', '#B04040'], accent: '#60B040', glow: '#40A04040' },
  cel: { bg: ['#080C10', '#0C1018', '#0A1410'], fg: ['#40B870', '#80E0A0', '#8090C0'], accent: '#50C878', glow: '#40B87040' },
  egy: { bg: ['#100C00', '#181400', '#201800'], fg: ['#C09010', '#FFD840', '#806000'], accent: '#E0A820', glow: '#FFD04040' },
  neu: { bg: ['#0C0C0C', '#101010', '#141414'], fg: ['#A0A0A0', '#C8C8C8', '#808080'], accent: '#B0B0B0', glow: '#A0A0A040' },
};

function getPalette(artKey: string) {
  const prefix = artKey.split('_')[0];
  return FACTION_PALETTES[prefix] || FACTION_PALETTES.neu;
}

// Determine weather animation class from artKey
function getWeatherAnimClass(artKey: string): string | null {
  const k = artKey.toLowerCase();
  if (k.includes('fimbulwinter') || k.includes('dead_winter') || k.includes('morana_frost')) return 'weather-blizzard';
  if (k.includes('monsoon_veil')) return 'weather-rain';
  if (k.includes('blinding_sandstorm')) return 'weather-sandstorm';
  if (k.includes('mist_of_avalon') || k.includes('oracle_drought')) return 'weather-mist';
  if (k.includes('ashen_eclipse')) return 'weather-eclipse';
  return null;
}

// Art generation functions per card type
function renderHeroic(seed: number, pal: typeof FACTION_PALETTES.hel, w: number, h: number) {
  const r1 = seededRand(seed, 1);
  
  return (
    <>
      <radialGradient id={`rg${seed}`} cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor={pal.glow} stopOpacity="1" />
        <stop offset="100%" stopColor={pal.bg[0]} stopOpacity="1" />
      </radialGradient>
      <rect width={w} height={h} fill={`url(#rg${seed})`} />
      {[0.2, 0.8].map((x, i) => (
        <rect key={i} x={x * w - 8} y={h * 0.2} width={16} height={h * 0.6} 
          fill={pal.fg[0]} opacity={0.15} rx={3} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + r1;
        const len = (0.3 + seededRand(seed, 10 + i) * 0.2) * Math.min(w, h);
        return (
          <line key={i}
            x1={w * 0.5} y1={h * 0.38}
            x2={w * 0.5 + Math.cos(angle) * len}
            y2={h * 0.38 + Math.sin(angle) * len}
            stroke={pal.accent} strokeWidth={1.5} opacity={0.35}
          />
        );
      })}
      <ellipse cx={w * 0.5} cy={h * 0.78} rx={w * 0.22} ry={h * 0.05} fill={pal.bg[0]} opacity={0.8} />
      <rect x={w*0.42} y={h*0.42} width={w*0.16} height={h*0.28} rx={4} fill={pal.fg[0]} opacity={0.9} />
      <ellipse cx={w*0.5} cy={h*0.37} rx={w*0.08} ry={h*0.06} fill={pal.fg[1]} opacity={0.9} />
      <polygon points={`${w*0.5},${h*0.24} ${w*0.46},${h*0.32} ${w*0.54},${h*0.32}`} 
        fill={pal.accent} opacity={0.95} />
      <line x1={w*0.42} y1={h*0.48} x2={w*0.3} y2={h*0.58} stroke={pal.fg[0]} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
      <line x1={w*0.58} y1={h*0.48} x2={w*0.7} y2={h*0.55} stroke={pal.fg[0]} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
      <line x1={w*0.7} y1={h*0.32} x2={w*0.7} y2={h*0.68} stroke={pal.fg[2]} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <polygon points={`${w*0.7},${h*0.3} ${w*0.68},${h*0.37} ${w*0.72},${h*0.37}`} fill={pal.accent} />
      <circle cx={w*0.5} cy={h*0.38} r={w*0.18} fill="none" stroke={pal.accent} strokeWidth={2} opacity={0.4} />
      <circle cx={w*0.5} cy={h*0.38} r={w*0.25} fill="none" stroke={pal.accent} strokeWidth={0.8} opacity={0.2} />
    </>
  );
}

function renderWarrior(seed: number, pal: typeof FACTION_PALETTES.hel, w: number, h: number) {
  const r1 = seededRand(seed, 1);
  const r2 = seededRand(seed, 2);
  
  return (
    <>
      <linearGradient id={`lg${seed}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={pal.bg[2]} />
        <stop offset="100%" stopColor={pal.bg[0]} />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#lg${seed})`} />
      <path d={`M0,${h*0.65} Q${w*0.25},${h*(0.5+r1*0.1)} ${w*0.5},${h*0.6} Q${w*0.75},${h*(0.55+r2*0.1)} ${w},${h*0.62} L${w},${h} L0,${h} Z`}
        fill={pal.bg[1]} opacity={0.7} />
      {Array.from({ length: 12 }).map((_, i) => (
        <circle key={i}
          cx={seededRand(seed, 20 + i) * w}
          cy={seededRand(seed, 30 + i) * h * 0.7}
          r={seededRand(seed, 40 + i) * 2 + 0.5}
          fill={pal.fg[0]} opacity={seededRand(seed, 50 + i) * 0.4 + 0.1}
        />
      ))}
      <ellipse cx={w*0.5} cy={h*0.82} rx={w*0.16} ry={h*0.04} fill={pal.bg[0]} opacity={0.6} />
      <rect x={w*0.44} y={h*0.66} width={w*0.06} height={h*0.18} rx={2} fill={pal.fg[0]} opacity={0.85} />
      <rect x={w*0.5} y={h*0.66} width={w*0.06} height={h*0.2} rx={2} fill={pal.fg[0]} opacity={0.8} />
      <rect x={w*0.40} y={h*0.42} width={w*0.20} height={h*0.26} rx={5} fill={pal.fg[0]} opacity={0.9} />
      <ellipse cx={w*0.5} cy={h*0.38} rx={w*0.08} ry={h*0.055} fill={pal.fg[1]} opacity={0.9} />
      <path d={`M${w*0.42},${h*0.37} Q${w*0.5},${h*0.26} ${w*0.58},${h*0.37}`} fill={pal.accent} opacity={0.85} />
      <ellipse cx={w*0.3} cy={h*0.52} rx={w*0.09} ry={h*0.11} fill={pal.fg[2]} opacity={0.75} />
      <ellipse cx={w*0.3} cy={h*0.52} rx={w*0.05} ry={h*0.07} fill={pal.accent} opacity={0.3} />
      <line x1={w*0.6} y1={h*0.46} x2={w*0.73} y2={h*0.32} stroke={pal.fg[2]} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
      <polygon points={`${w*0.73},${h*0.28} ${w*0.70},${h*0.34} ${w*0.76},${h*0.34}`} fill={pal.accent} />
      <circle cx={w*0.73} cy={h*0.3} r={w*0.04} fill={pal.glow} opacity={0.6} />
    </>
  );
}

function renderCreature(seed: number, pal: typeof FACTION_PALETTES.hel, w: number, h: number) {
  return (
    <>
      <radialGradient id={`crg${seed}`} cx="50%" cy="60%" r="60%">
        <stop offset="0%" stopColor={pal.bg[2]} />
        <stop offset="100%" stopColor={pal.bg[0]} />
      </radialGradient>
      <rect width={w} height={h} fill={`url(#crg${seed})`} />
      <path d={`M0,${h*0.72} Q${w*0.3},${h*0.68} ${w*0.5},${h*0.7} Q${w*0.7},${h*0.72} ${w},${h*0.69} L${w},${h} L0,${h} Z`}
        fill={pal.bg[1]} opacity={0.8} />
      <ellipse cx={w*0.5} cy={h*0.55} rx={w*0.22} ry={h*0.2} fill={pal.fg[0]} opacity={0.85} />
      <ellipse cx={w*0.5} cy={h*0.35} rx={w*0.16} ry={h*0.13} fill={pal.fg[0]} opacity={0.9} />
      <circle cx={w*0.44} cy={h*0.34} r={w*0.025} fill={pal.glow} opacity={0.9} />
      <circle cx={w*0.56} cy={h*0.34} r={w*0.025} fill={pal.glow} opacity={0.9} />
      <circle cx={w*0.44} cy={h*0.34} r={w*0.01} fill={pal.accent} />
      <circle cx={w*0.56} cy={h*0.34} r={w*0.01} fill={pal.accent} />
      <polygon points={`${w*0.42},${h*0.26} ${w*0.38},${h*0.18} ${w*0.46},${h*0.27}`} fill={pal.accent} opacity={0.85} />
      <polygon points={`${w*0.58},${h*0.26} ${w*0.62},${h*0.18} ${w*0.54},${h*0.27}`} fill={pal.accent} opacity={0.85} />
      <path d={`M${w*0.28},${h*0.5} Q${w*0.2},${h*0.55} ${w*0.18},${h*0.65}`} 
        stroke={pal.fg[0]} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={`M${w*0.72},${h*0.5} Q${w*0.8},${h*0.55} ${w*0.82},${h*0.65}`}
        stroke={pal.fg[0]} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.85} />
      {[-1, 0, 1].map((i) => (
        <line key={i} 
          x1={w*0.18 + i*5} y1={h*0.65} x2={w*0.15 + i*6} y2={h*0.72}
          stroke={pal.accent} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      ))}
    </>
  );
}

function renderSpecial(seed: number, pal: typeof FACTION_PALETTES.hel, w: number, h: number) {
  const r1 = seededRand(seed, 1);
  
  return (
    <>
      <radialGradient id={`spg${seed}`} cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor={pal.glow} />
        <stop offset="70%" stopColor={pal.bg[1]} />
        <stop offset="100%" stopColor={pal.bg[0]} />
      </radialGradient>
      <rect width={w} height={h} fill={`url(#spg${seed})`} />
      <circle cx={w*0.5} cy={h*0.5} r={w*0.35} fill="none" stroke={pal.accent} strokeWidth={1.5} opacity={0.5} />
      <circle cx={w*0.5} cy={h*0.5} r={w*0.25} fill="none" stroke={pal.fg[0]} strokeWidth={1} opacity={0.4} />
      <circle cx={w*0.5} cy={h*0.5} r={w*0.15} fill={pal.accent} opacity={0.15} />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2 + r1;
        const x = w * 0.5 + Math.cos(angle) * w * 0.35;
        const y = h * 0.5 + Math.sin(angle) * w * 0.35;
        return <circle key={i} cx={x} cy={y} r={4} fill={pal.accent} opacity={0.7} />;
      })}
      {Array.from({ length: 5 }).map((_, i) => {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const nextAngle = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
        return (
          <line key={i}
            x1={w*0.5 + Math.cos(angle) * w*0.14}
            y1={h*0.5 + Math.sin(angle) * w*0.14}
            x2={w*0.5 + Math.cos(nextAngle) * w*0.14}
            y2={h*0.5 + Math.sin(nextAngle) * w*0.14}
            stroke={pal.accent} strokeWidth={2} opacity={0.8}
          />
        );
      })}
    </>
  );
}

function renderWeather(seed: number, pal: typeof FACTION_PALETTES.hel, w: number, h: number) {
  return (
    <>
      <linearGradient id={`wlg${seed}`} x1="0%" y1="0%" x2="20%" y2="100%">
        <stop offset="0%" stopColor={pal.bg[2]} />
        <stop offset="100%" stopColor={pal.bg[0]} />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#wlg${seed})`} />
      {Array.from({ length: 20 }).map((_, i) => {
        const x = seededRand(seed, 100 + i) * w;
        const y = seededRand(seed, 200 + i) * h;
        const len = (seededRand(seed, 300 + i) * 0.12 + 0.05) * h;
        return (
          <line key={i} x1={x} y1={y} x2={x - len*0.3} y2={y + len}
            stroke={pal.fg[0]} strokeWidth={seededRand(seed, 400 + i) * 1.5 + 0.5}
            opacity={seededRand(seed, 500 + i) * 0.4 + 0.1}
          />
        );
      })}
      {[0.3, 0.6, 0.15, 0.8, 0.5].map((x, i) => (
        <ellipse key={i}
          cx={x * w}
          cy={(seededRand(seed, 600 + i) * 0.5 + 0.1) * h}
          rx={seededRand(seed, 700 + i) * w * 0.2 + w * 0.08}
          ry={seededRand(seed, 800 + i) * h * 0.06 + h * 0.03}
          fill={pal.fg[0]} opacity={seededRand(seed, 900 + i) * 0.15 + 0.08}
        />
      ))}
      <circle cx={w*0.5} cy={h*0.45} r={w*0.15} fill={pal.accent} opacity={0.1} />
      <circle cx={w*0.5} cy={h*0.45} r={w*0.08} fill={pal.accent} opacity={0.25} />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <line key={i}
            x1={w*0.5 + Math.cos(angle) * w*0.1}
            y1={h*0.45 + Math.sin(angle) * w*0.1}
            x2={w*0.5 + Math.cos(angle) * w*0.17}
            y2={h*0.45 + Math.sin(angle) * w*0.17}
            stroke={pal.accent} strokeWidth={2.5} opacity={0.6}
          />
        );
      })}
    </>
  );
}

function renderRitual(seed: number, pal: typeof FACTION_PALETTES.hel, w: number, h: number) {
  return (
    <>
      <linearGradient id={`rlg${seed}`} x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor={pal.bg[0]} />
        <stop offset="100%" stopColor={pal.bg[2]} />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#rlg${seed})`} />
      <rect x={w*0.1} y={h*0.7} width={w*0.8} height={h*0.06} rx={2} fill={pal.fg[0]} opacity={0.5} />
      <rect x={w*0.25} y={h*0.28} width={w*0.5} height={h*0.44} rx={4} fill={pal.fg[0]} opacity={0.6} />
      <rect x={w*0.3} y={h*0.35} width={w*0.1} height={h*0.2} rx={2} fill={pal.accent} opacity={0.4} />
      <rect x={w*0.6} y={h*0.35} width={w*0.1} height={h*0.2} rx={2} fill={pal.accent} opacity={0.4} />
      <polygon points={`${w*0.25},${h*0.28} ${w*0.5},${h*0.12} ${w*0.75},${h*0.28}`} 
        fill={pal.fg[0]} opacity={0.7} />
      <circle cx={w*0.5} cy={h*0.12} r={w*0.05} fill={pal.accent} opacity={0.5} />
      <circle cx={w*0.5} cy={h*0.12} r={w*0.1} fill={pal.glow} opacity={0.3} />
      <rect x={w*0.15} y={h*0.32} width={w*0.07} height={h*0.4} rx={2} fill={pal.fg[2]} opacity={0.45} />
      <rect x={w*0.78} y={h*0.32} width={w*0.07} height={h*0.4} rx={2} fill={pal.fg[2]} opacity={0.45} />
    </>
  );
}

function getArtRenderer(artKey: string) {
  const k = artKey.toLowerCase();
  if (k.includes('thunder_born') || k.includes('avatar') || k.includes('wolf_last') || 
      k.includes('chernobog') || k.includes('silver_king') || k.includes('sun_disk')) {
    return 'heroic';
  }
  if (k.includes('weather') || k.includes('frost') || k.includes('fimbul') || 
      k.includes('morana') || k.includes('veil') || k.includes('drought') ||
      k.includes('eclipse') || k.includes('sandstorm') || k.includes('mist_of') ||
      k.includes('dead_winter')) {
    return 'weather';
  }
  if (k.includes('beacon') || k.includes('masonry') || k.includes('trebuchet') ||
      k.includes('roots') || k.includes('baba_yaga') || k.includes('mortar') ||
      k.includes('idol') || k.includes('chariot') || k.includes('gaja') ||
      k.includes('ashva') || k.includes('obelisk') || k.includes('duat') ||
      k.includes('pyramid') || k.includes('stone_circle') || k.includes('cauldron') ||
      k.includes('knotwork') || k.includes('ballista') || k.includes('longship')) {
    return 'ritual';
  }
  if (k.includes('minotaur') || k.includes('gatebreaker') || k.includes('leshy') ||
      k.includes('zmey') || k.includes('jotunn') || k.includes('troll') ||
      k.includes('scarab') || k.includes('sekhmet') || k.includes('garuda') ||
      k.includes('naga') || k.includes('rusalka') || k.includes('bog') ||
      k.includes('morrigan') || k.includes('banshee') || k.includes('serpent_of')) {
    return 'creature';
  }
  if (k.includes('triumph') || k.includes('thread') || k.includes('wrath') ||
      k.includes('mantra') || k.includes('brahmastra') || k.includes('omen') ||
      k.includes('ravens') || k.includes('vow') || k.includes('ragnarok') ||
      k.includes('bargain') || k.includes('charm') || k.includes('curse') ||
      k.includes('fires') || k.includes('geas') || k.includes('exchange') ||
      k.includes('maat') || k.includes('book_of') || k.includes('crook') ||
      k.includes('invocation') || k.includes('judgement') || k.includes('mask') ||
      k.includes('hymn') || k.includes('soma_offering') || k.includes('odin') ||
      k.includes('blood_eagle')) {
    return 'special';
  }
  return 'warrior';
}

// SVG fallback art component
function SvgFallback({ artKey, width, height }: { artKey: string; width: number; height: number }) {
  const seed = hashStr(artKey);
  const pal = getPalette(artKey);
  const renderer = getArtRenderer(artKey);
  const w = width;
  const h = height;

  let content: React.ReactNode;
  switch (renderer) {
    case 'heroic': content = renderHeroic(seed, pal, w, h); break;
    case 'creature': content = renderCreature(seed, pal, w, h); break;
    case 'ritual': content = renderRitual(seed, pal, w, h); break;
    case 'special': content = renderSpecial(seed, pal, w, h); break;
    case 'weather': content = renderWeather(seed, pal, w, h); break;
    default: content = renderWarrior(seed, pal, w, h);
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={`clip${seed}`}>
          <rect width={width} height={height} rx={4} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip${seed})`}>
        {content}
      </g>
    </svg>
  );
}

// Weather overlay rendered on top of card art
function WeatherOverlay({ animClass, width, height }: { animClass: string; width: number; height: number }) {
  return (
    <div
      className={`weather-overlay ${animClass}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function CardArt({ artKey, width = 120, height = 180, className, style, onLoad }: ArtProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const weatherAnimClass = getWeatherAnimClass(artKey);
  // Use compressed JPG for fast loading; fallback to PNG if JPG missing
  const imgSrc = `./card-art/${artKey}.jpg`;

  return (
    <div
      className={className}
      style={{ width, height, position: 'relative', overflow: 'hidden', borderRadius: 4, flexShrink: 0, ...style }}
    >
      {/* Real AI-generated image — falls back to SVG if missing */}
      {!imgFailed ? (
        <img
          src={imgSrc}
          alt={artKey}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onLoad={onLoad}
          onError={() => { setImgFailed(true); onLoad?.(); }}
          style={{
            display: 'block',
            width,
            height,
            objectFit: 'cover',
            borderRadius: 4,
          }}
        />
      ) : (
        <SvgFallback artKey={artKey} width={width} height={height} />
      )}

      {/* Animated weather overlay for weather-type cards */}
      {weatherAnimClass && (
        <WeatherOverlay animClass={weatherAnimClass} width={width} height={height} />
      )}
    </div>
  );
}
