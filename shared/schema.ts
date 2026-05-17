// Gwunt - Mythology Card Battler
// No persistent DB needed for this single-player POC - all state in memory

export type Faction = 'hellenic' | 'vedic' | 'norse' | 'slavic' | 'celtic' | 'egyptian' | 'neutral';
export type Row = 'close' | 'ranged' | 'ritual';
export type Ability = 'heroic' | 'inspire' | 'seer' | 'restore' | 'warband' | 'doom' | 'commander' | 'weather' | 'oathbound' | 'special' | 'none';
export type CardType = 'unit' | 'special' | 'weather';
export type WeatherTarget = 'close' | 'ranged' | 'ritual' | 'all';

export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  type: CardType;
  row?: Row; // undefined for specials/weather
  strength: number;
  ability: Ability;
  abilityData?: {
    weatherTarget?: WeatherTarget;
    buffAmount?: number;
    buffRow?: 'close' | 'ranged' | 'ritual' | 'self';
  };
  description: string;
  artKey: string; // references SVG art
  lore?: string;
}

export interface CardInstance {
  instanceId: string;
  def: CardDef;
  currentStrength: number;
  isWeatherReduced: boolean;
  isCommanderDoubled: boolean;
  abilityDisabled?: boolean;
}

export interface RowState {
  units: CardInstance[];
  hasWeather: boolean;
  hasCommander: boolean;
}

export interface BattlefieldState {
  close: RowState;
  ranged: RowState;
  ritual: RowState;
}

export interface PlayerState {
  faction: Faction;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  battlefield: BattlefieldState;
  roundsWon: number;
  hasPassed: boolean;
  leaderUsed: boolean;
}

export type GamePhase = 
  | 'title'
  | 'faction-select'
  | 'mulligan'
  | 'battle'
  | 'round-end'
  | 'game-over'
  | 'gallery';

// A single event that fires as part of an action (shown in notification banner)
export interface GameEvent {
  id: string;           // unique, for React keys
  type: 'ability' | 'weather' | 'round' | 'pass' | 'doom' | 'restore' | 'seer' | 'warband' | 'leader';
  who: 'player' | 'ai';
  message: string;      // Human-readable description
  cardName?: string;    // Card that triggered the event
  targetName?: string;  // Card that was affected
  icon?: string;        // Emoji icon
}

export interface GameState {
  phase: GamePhase;
  player: PlayerState;
  ai: PlayerState;
  round: number; // 1-3
  currentTurn: 'player' | 'ai';
  weatherEffects: { close: boolean; ranged: boolean; ritual: boolean };
  lastAction?: string;
  winner?: 'player' | 'ai' | 'draw';
  roundWinners: Array<'player' | 'ai' | 'draw'>;
  mulligansLeft: number;
  selectedFaction: Faction | null;
  events: GameEvent[]; // Events from the last action — consumed by UI for notifications
}
