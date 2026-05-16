import type { CardDef, CardInstance, PlayerState, BattlefieldState, RowState, GameState, Faction, Row } from '../../../shared/schema';
import { buildStarterDeck } from '../data/cards';

let instanceCounter = 0;

function createInstance(def: CardDef): CardInstance {
  return {
    instanceId: `${def.id}_${++instanceCounter}`,
    def,
    currentStrength: def.strength,
    isWeatherReduced: false,
    isCommanderDoubled: false,
  };
}

function emptyRow(): RowState {
  return { units: [], hasWeather: false, hasCommander: false };
}

function emptyBattlefield(): BattlefieldState {
  return { close: emptyRow(), ranged: emptyRow(), ritual: emptyRow() };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createPlayerState(faction: Faction): PlayerState {
  const deckDefs = buildStarterDeck(faction as string);
  const deck = shuffle(deckDefs.map(createInstance));
  const hand = deck.splice(0, 10);
  return {
    faction,
    hand,
    deck,
    discard: [],
    battlefield: emptyBattlefield(),
    roundsWon: 0,
    hasPassed: false,
    leaderUsed: false,
  };
}

export function getRowScore(row: RowState): number {
  return row.units.reduce((sum, u) => sum + u.currentStrength, 0);
}

export function getTotalScore(bf: BattlefieldState): number {
  return getRowScore(bf.close) + getRowScore(bf.ranged) + getRowScore(bf.ritual);
}

function applyWeatherToRow(row: RowState, isActive: boolean): RowState {
  return {
    ...row,
    hasWeather: isActive,
    units: row.units.map(u => {
      if (u.def.ability === 'heroic') return u;
      return {
        ...u,
        currentStrength: isActive ? 1 : recalcStrength(u),
        isWeatherReduced: isActive,
      };
    }),
  };
}

function recalcStrength(unit: CardInstance): number {
  return unit.def.strength;
}

export function applyInspire(row: RowState): RowState {
  const inspireCount = row.units.filter(u => u.def.ability === 'inspire' && !u.abilityDisabled).length;
  if (inspireCount === 0) return row;
  const units = row.units.map(u => {
    if (u.def.ability === 'inspire' || u.def.ability === 'heroic' || u.isWeatherReduced) return u;
    return { ...u, currentStrength: u.currentStrength + inspireCount };
  });
  return { ...row, units };
}

export function applyOathbound(row: RowState): RowState {
  const counts: Record<string, number> = {};
  row.units.forEach(u => { 
    if (u.def.ability === 'oathbound') counts[u.def.id] = (counts[u.def.id] || 0) + 1;
  });
  const units = row.units.map(u => {
    if (u.def.ability !== 'oathbound') return u;
    const count = counts[u.def.id] || 0;
    if (count > 1) return { ...u, currentStrength: u.def.strength * 2 };
    return u;
  });
  return { ...row, units };
}

function recalcRow(row: RowState): RowState {
  // Reset to base first
  let r = { ...row, units: row.units.map(u => ({ ...u, currentStrength: u.isWeatherReduced ? 1 : u.def.strength })) };
  r = applyOathbound(r);
  r = applyInspire(r);
  return r;
}

export function recalcBattlefield(bf: BattlefieldState, weather: { close: boolean; ranged: boolean; ritual: boolean }): BattlefieldState {
  let close = recalcRow(bf.close);
  let ranged = recalcRow(bf.ranged);
  let ritual = recalcRow(bf.ritual);
  
  if (weather.close) close = applyWeatherToRow(close, true);
  if (weather.ranged) ranged = applyWeatherToRow(ranged, true);
  if (weather.ritual) ritual = applyWeatherToRow(ritual, true);
  
  if (close.hasCommander) {
    close = { ...close, units: close.units.map(u => ({ ...u, currentStrength: u.currentStrength * 2 })) };
  }
  if (ranged.hasCommander) {
    ranged = { ...ranged, units: ranged.units.map(u => ({ ...u, currentStrength: u.currentStrength * 2 })) };
  }
  if (ritual.hasCommander) {
    ritual = { ...ritual, units: ritual.units.map(u => ({ ...u, currentStrength: u.currentStrength * 2 })) };
  }
  
  return { close, ranged, ritual };
}

export type GameAction =
  | { type: 'PLAY_UNIT'; cardInstanceId: string; row: Row; target?: string }
  | { type: 'PLAY_SPECIAL'; cardInstanceId: string; target?: string; targetRow?: Row }
  | { type: 'PLAY_WEATHER'; cardInstanceId: string }
  | { type: 'PASS' }
  | { type: 'USE_LEADER'; target?: string; targetRow?: Row }
  | { type: 'MULLIGAN'; cardInstanceId: string }
  | { type: 'END_MULLIGAN' }
  | { type: 'SELECT_FACTION'; faction: Faction }
  | { type: 'START_BATTLE' }
  | { type: 'REMATCH' }
  | { type: 'AI_TURN' };

export function findCardInHand(state: GameState, who: 'player' | 'ai', instanceId: string): CardInstance | undefined {
  return state[who].hand.find(c => c.instanceId === instanceId);
}

function removeFromHand(hand: CardInstance[], instanceId: string): { card: CardInstance; hand: CardInstance[] } {
  const idx = hand.findIndex(c => c.instanceId === instanceId);
  const card = hand[idx];
  return { card, hand: hand.filter((_, i) => i !== idx) };
}

function addToRow(row: RowState, unit: CardInstance): RowState {
  return { ...row, units: [...row.units, unit] };
}

// Get all non-heroic units across both battlefields
function getAllNonHeroicUnits(state: GameState): { unit: CardInstance; owner: 'player' | 'ai'; row: Row }[] {
  const units: { unit: CardInstance; owner: 'player' | 'ai'; row: Row }[] = [];
  (['player', 'ai'] as const).forEach(owner => {
    (['close', 'ranged', 'ritual'] as const).forEach(row => {
      state[owner].battlefield[row].units
        .filter(u => u.def.ability !== 'heroic')
        .forEach(u => units.push({ unit: u, owner, row }));
    });
  });
  return units;
}

function findStrongestNonHeroic(state: GameState): { unit: CardInstance; owner: 'player' | 'ai'; row: Row } | null {
  const units = getAllNonHeroicUnits(state);
  if (units.length === 0) return null;
  const maxStr = Math.max(...units.map(u => u.unit.currentStrength));
  const strongest = units.filter(u => u.unit.currentStrength === maxStr);
  return strongest[0] || null;
}

function removeUnitFromBattlefield(
  bf: BattlefieldState, 
  instanceId: string
): { bf: BattlefieldState; removed: CardInstance | null } {
  let removed: CardInstance | null = null;
  const newBf = { ...bf };
  (['close', 'ranged', 'ritual'] as Row[]).forEach(row => {
    const idx = newBf[row].units.findIndex(u => u.instanceId === instanceId);
    if (idx !== -1) {
      removed = newBf[row].units[idx];
      newBf[row] = { ...newBf[row], units: newBf[row].units.filter((_, i) => i !== idx) };
    }
  });
  return { bf: newBf, removed };
}

function pullWarbandFromDeck(state: GameState, who: 'player' | 'ai', def: CardDef): GameState {
  let s = { ...state };
  const player = { ...s[who] };
  // Find all warband copies in deck
  const copies = player.deck.filter(c => c.def.id === def.id);
  if (copies.length === 0) return s;
  
  const row = def.row!;
  copies.forEach(c => {
    player.battlefield = {
      ...player.battlefield,
      [row]: addToRow(player.battlefield[row], c),
    };
  });
  player.deck = player.deck.filter(c => c.def.id !== def.id);
  s[who] = player;
  return s;
}

export function applyAction(state: GameState, action: GameAction, who: 'player' | 'ai'): GameState {
  let s = { ...state };
  const opponent = who === 'player' ? 'ai' : 'player';

  switch (action.type) {
    case 'PLAY_UNIT': {
      const { card, hand } = removeFromHand(s[who].hand, action.cardInstanceId);
      if (!card || !card.def.row) return s;
      const row = action.row;
      if (card.def.row !== row) return s;

      let bf = { ...s[who].battlefield };
      bf[row] = addToRow(bf[row], card);
      
      let newS = {
        ...s,
        [who]: { ...s[who], hand, battlefield: bf },
        lastAction: `${who === 'player' ? 'You' : 'AI'} played ${card.def.name}`,
      };

      // Handle warband
      if (card.def.ability === 'warband') {
        newS = pullWarbandFromDeck(newS, who, card.def);
      }

      // Handle seer: give opponent the card's strength, player draws 2
      if (card.def.ability === 'seer') {
        // Move card to opponent's row
        const opp = { ...newS[opponent] };
        const ownBf = { ...newS[who].battlefield };
        // Remove from own bf
        ownBf[row] = { ...ownBf[row], units: ownBf[row].units.filter(u => u.instanceId !== card.instanceId) };
        // Add to opponent's ranged (seer goes to opponent side)
        opp.battlefield = {
          ...opp.battlefield,
          [row]: addToRow(opp.battlefield[row], card),
        };
        // Draw 2 for current player
        const ownPlayer = { ...newS[who] };
        const drawn = ownPlayer.deck.slice(0, 2);
        ownPlayer.deck = ownPlayer.deck.slice(2);
        ownPlayer.hand = [...ownPlayer.hand, ...drawn];
        ownPlayer.battlefield = ownBf;
        newS = { ...newS, [who]: ownPlayer, [opponent]: opp };
      }

      // Handle doom: destroy strongest non-heroic on field
      if (card.def.ability === 'doom') {
        const strongest = findStrongestNonHeroic(newS);
        if (strongest) {
          const { bf: newBf, removed } = removeUnitFromBattlefield(newS[strongest.owner].battlefield, strongest.unit.instanceId);
          if (removed) {
            newS = {
              ...newS,
              [strongest.owner]: {
                ...newS[strongest.owner],
                battlefield: newBf,
                discard: [...newS[strongest.owner].discard, removed],
              },
            };
          }
        }
      }

      // Handle inspire: recalc row
      // Handle restore: would need target selection - simplified auto-pick first in discard
      if (card.def.ability === 'restore') {
        const discards = newS[who].discard.filter(u => u.def.type === 'unit' && u.def.ability !== 'heroic');
        if (discards.length > 0) {
          const toRevive = discards[0];
          const revived = { ...toRevive, currentStrength: toRevive.def.strength, isWeatherReduced: false };
          const revRow = toRevive.def.row || 'close';
          newS = {
            ...newS,
            [who]: {
              ...newS[who],
              discard: newS[who].discard.filter(u => u.instanceId !== toRevive.instanceId),
              battlefield: {
                ...newS[who].battlefield,
                [revRow]: addToRow(newS[who].battlefield[revRow], revived),
              },
            },
          };
        }
      }

      // Recalculate
      newS[who] = { ...newS[who], battlefield: recalcBattlefield(newS[who].battlefield, newS.weatherEffects) };
      newS[opponent] = { ...newS[opponent], battlefield: recalcBattlefield(newS[opponent].battlefield, newS.weatherEffects) };

      return { ...newS, currentTurn: opponent };
    }

    case 'PLAY_SPECIAL': {
      const { card, hand } = removeFromHand(s[who].hand, action.cardInstanceId);
      if (!card) return s;
      
      let newS = { ...s, [who]: { ...s[who], hand }, lastAction: `${who === 'player' ? 'You' : 'AI'} played ${card.def.name}` };

      // Dawn Invocation: clear all weather
      if (card.def.name === 'Dawn Invocation' || card.def.ability === 'special' && card.def.description.includes('Remove all weather')) {
        newS.weatherEffects = { close: false, ranged: false, ritual: false };
        newS[who] = { ...newS[who], battlefield: recalcBattlefield(newS[who].battlefield, newS.weatherEffects) };
        newS[opponent] = { ...newS[opponent], battlefield: recalcBattlefield(newS[opponent].battlefield, newS.weatherEffects) };
      }

      // Commander (Battle Hymn, Sacred Mantra, etc.) - double a row
      if (card.def.ability === 'commander') {
        const targetRow = action.targetRow || 'close';
        if (!newS[who].battlefield[targetRow].hasCommander) {
          newS[who] = {
            ...newS[who],
            battlefield: {
              ...newS[who].battlefield,
              [targetRow]: {
                ...newS[who].battlefield[targetRow],
                hasCommander: true,
              },
            },
          };
          newS[who].battlefield = recalcBattlefield(newS[who].battlefield, newS.weatherEffects);
        }
      }

      // Doom specials
      if (card.def.ability === 'doom') {
        const strongest = findStrongestNonHeroic(newS);
        if (strongest) {
          const { bf: newBf, removed } = removeUnitFromBattlefield(newS[strongest.owner].battlefield, strongest.unit.instanceId);
          if (removed) {
            newS = {
              ...newS,
              [strongest.owner]: {
                ...newS[strongest.owner],
                battlefield: newBf,
                discard: [...newS[strongest.owner].discard, removed],
              },
            };
          }
        }
      }

      // Restore specials (Book of Gates, etc.)
      if (card.def.ability === 'restore') {
        const discards = newS[who].discard.filter(u => u.def.type === 'unit' && u.def.ability !== 'heroic');
        if (discards.length > 0) {
          const toRevive = discards[0];
          const revived = { ...toRevive, currentStrength: toRevive.def.strength, isWeatherReduced: false };
          const revRow = toRevive.def.row || 'close';
          newS = {
            ...newS,
            [who]: {
              ...newS[who],
              discard: newS[who].discard.filter(u => u.instanceId !== toRevive.instanceId),
              battlefield: {
                ...newS[who].battlefield,
                [revRow]: addToRow(newS[who].battlefield[revRow], revived),
              },
            },
          };
        }
      }

      // +2 row buffs
      if (card.def.abilityData?.buffAmount && action.targetRow) {
        const targetRow = action.targetRow;
        const buffAmt = card.def.abilityData.buffAmount;
        const row = newS[who].battlefield[targetRow];
        const buffedRow = {
          ...row,
          units: row.units.map(u => 
            u.def.ability !== 'heroic' && !u.isWeatherReduced
              ? { ...u, currentStrength: u.currentStrength + buffAmt }
              : u
          ),
        };
        newS[who] = {
          ...newS[who],
          battlefield: { ...newS[who].battlefield, [targetRow]: buffedRow },
        };
      }

      // Recall (Moirai Thread, Red Thread Charm, Trickster Mask)
      if (card.def.description.includes('Return one friendly') && action.target) {
        const { bf: newBf, removed } = removeUnitFromBattlefield(newS[who].battlefield, action.target);
        if (removed && removed.def.ability !== 'heroic') {
          newS = {
            ...newS,
            [who]: {
              ...newS[who],
              battlefield: newBf,
              hand: [...newS[who].hand, { ...removed, currentStrength: removed.def.strength }],
            },
          };
        }
      }

      // Soma Offering: draw 1, discard 1
      if (card.def.name === 'Soma Offering') {
        if (newS[who].deck.length > 0) {
          const drawn = newS[who].deck[0];
          newS[who] = {
            ...newS[who],
            hand: [...newS[who].hand, drawn],
            deck: newS[who].deck.slice(1),
          };
        }
        // Auto-discard last card in hand (simplification)
        if (newS[who].hand.length > 0) {
          const last = newS[who].hand[newS[who].hand.length - 1];
          newS[who] = {
            ...newS[who],
            hand: newS[who].hand.slice(0, -1),
            discard: [...newS[who].discard, last],
          };
        }
      }

      // Veles Bargain: draw 2, give opponent 4-strength token
      if (card.def.name === 'Veles Bargain') {
        const drawn = newS[who].deck.slice(0, 2);
        newS[who] = {
          ...newS[who],
          hand: [...newS[who].hand, ...drawn],
          deck: newS[who].deck.slice(2),
        };
        // Token card
        const token: CardInstance = {
          instanceId: `token_${Date.now()}`,
          def: { id: 'token_veles', name: 'Veles Token', faction: 'slavic', type: 'unit', row: 'close', strength: 4, ability: 'none', description: 'A token from Veles Bargain.', artKey: 'slv_veles_bargain' },
          currentStrength: 4,
          isWeatherReduced: false,
          isCommanderDoubled: false,
        };
        newS[opponent] = {
          ...newS[opponent],
          hand: [...newS[opponent].hand, token],
        };
      }

      // Fae Exchange: return a unit, draw 1
      if (card.def.name === 'Fae Exchange' && action.target) {
        const { bf: newBf, removed } = removeUnitFromBattlefield(newS[who].battlefield, action.target);
        if (removed) {
          const drawn = newS[who].deck.slice(0, 1);
          newS[who] = {
            ...newS[who],
            battlefield: newBf,
            hand: [...newS[who].hand, { ...removed, currentStrength: removed.def.strength }, ...drawn],
            deck: newS[who].deck.slice(1),
          };
        }
      }

      // Odin Ravens: reveal 2 enemy, draw 1
      if (card.def.name === 'Odin Ravens') {
        const drawn = newS[who].deck.slice(0, 1);
        newS[who] = {
          ...newS[who],
          hand: [...newS[who].hand, ...drawn],
          deck: newS[who].deck.slice(1),
        };
      }

      newS[who] = { ...newS[who], battlefield: recalcBattlefield(newS[who].battlefield, newS.weatherEffects) };
      newS[opponent] = { ...newS[opponent], battlefield: recalcBattlefield(newS[opponent].battlefield, newS.weatherEffects) };

      return { ...newS, currentTurn: opponent };
    }

    case 'PLAY_WEATHER': {
      const { card, hand } = removeFromHand(s[who].hand, action.cardInstanceId);
      if (!card) return s;
      
      const target = card.def.abilityData?.weatherTarget || 'close';
      let weather = { ...s.weatherEffects };
      
      if (target === 'all') {
        weather = { close: true, ranged: true, ritual: true };
      } else {
        weather[target as 'close' | 'ranged' | 'ritual'] = true;
      }

      let newS = {
        ...s,
        [who]: { ...s[who], hand },
        weatherEffects: weather,
        lastAction: `${who === 'player' ? 'You' : 'AI'} played ${card.def.name}`,
      };

      newS[who] = { ...newS[who], battlefield: recalcBattlefield(newS[who].battlefield, weather) };
      newS[opponent] = { ...newS[opponent], battlefield: recalcBattlefield(newS[opponent].battlefield, weather) };

      return { ...newS, currentTurn: opponent };
    }

    case 'USE_LEADER': {
      if (s[who].leaderUsed) return s;
      let newS = { ...s, [who]: { ...s[who], leaderUsed: true }, lastAction: `${who === 'player' ? 'You' : 'AI'} used leader ability` };

      const faction = s[who].faction;

      if (faction === 'hellenic') {
        // Reveal 2 random opponent cards, draw 1
        const drawn = newS[who].deck.slice(0, 1);
        newS[who] = { ...newS[who], hand: [...newS[who].hand, ...drawn], deck: newS[who].deck.slice(1) };
      } else if (faction === 'vedic') {
        // Revive one non-Heroic from discard
        const discards = newS[who].discard.filter(u => u.def.type === 'unit' && u.def.ability !== 'heroic');
        if (discards.length > 0) {
          const toRevive = discards[0];
          const revived = { ...toRevive, currentStrength: toRevive.def.strength };
          const revRow = toRevive.def.row || 'close';
          newS[who] = {
            ...newS[who],
            discard: newS[who].discard.filter(u => u.instanceId !== toRevive.instanceId),
            battlefield: { ...newS[who].battlefield, [revRow]: addToRow(newS[who].battlefield[revRow], revived) },
          };
        }
      } else if (faction === 'norse') {
        // Apply frost to enemy close row
        const weather = { ...newS.weatherEffects, close: true };
        newS.weatherEffects = weather;
        newS[opponent] = { ...newS[opponent], battlefield: recalcBattlefield(newS[opponent].battlefield, weather) };
      } else if (faction === 'slavic') {
        // Return one friendly unit to hand
        const allFriendly: CardInstance[] = [
          ...newS[who].battlefield.close.units,
          ...newS[who].battlefield.ranged.units,
          ...newS[who].battlefield.ritual.units,
        ].filter(u => u.def.ability !== 'heroic');
        if (allFriendly.length > 0) {
          const toRecall = action.target ? allFriendly.find(u => u.instanceId === action.target) : allFriendly[0];
          if (toRecall) {
            const { bf: newBf } = removeUnitFromBattlefield(newS[who].battlefield, toRecall.instanceId);
            newS[who] = {
              ...newS[who],
              battlefield: newBf,
              hand: [...newS[who].hand, { ...toRecall, currentStrength: toRecall.def.strength }],
            };
          }
        }
      } else if (faction === 'celtic') {
        // Double one friendly row
        const targetRow = action.targetRow || 'close';
        if (!newS[who].battlefield[targetRow].hasCommander) {
          newS[who].battlefield = {
            ...newS[who].battlefield,
            [targetRow]: { ...newS[who].battlefield[targetRow], hasCommander: true },
          };
        }
      } else if (faction === 'egyptian') {
        // If behind, doom strongest enemy non-heroic
        const playerScore = getTotalScore(newS.player.battlefield);
        const aiScore = getTotalScore(newS.ai.battlefield);
        const ownScore = who === 'player' ? playerScore : aiScore;
        const oppScore = who === 'player' ? aiScore : playerScore;
        if (ownScore < oppScore) {
          const strongest = getAllNonHeroicUnits(newS)
            .filter(u => u.owner === opponent)
            .sort((a, b) => b.unit.currentStrength - a.unit.currentStrength)[0];
          if (strongest) {
            const { bf: newBf, removed } = removeUnitFromBattlefield(newS[opponent].battlefield, strongest.unit.instanceId);
            if (removed) {
              newS[opponent] = { ...newS[opponent], battlefield: newBf, discard: [...newS[opponent].discard, removed] };
            }
          }
        }
      }

      newS[who] = { ...newS[who], battlefield: recalcBattlefield(newS[who].battlefield, newS.weatherEffects) };
      newS[opponent] = { ...newS[opponent], battlefield: recalcBattlefield(newS[opponent].battlefield, newS.weatherEffects) };

      return { ...newS, currentTurn: opponent };
    }

    case 'PASS': {
      return {
        ...s,
        [who]: { ...s[who], hasPassed: true },
        lastAction: `${who === 'player' ? 'You' : 'AI'} passed`,
        currentTurn: opponent,
      };
    }

    case 'MULLIGAN': {
      const { card, hand } = removeFromHand(s.player.hand, action.cardInstanceId);
      if (!card || s.mulligansLeft <= 0) return s;
      const deck = shuffle([...s.player.deck, card]);
      const drawn = deck.splice(0, 1);
      return {
        ...s,
        player: { ...s.player, hand: [...hand, ...drawn], deck },
        mulligansLeft: s.mulligansLeft - 1,
      };
    }

    case 'END_MULLIGAN': {
      return { ...s, phase: 'battle', currentTurn: 'player' };
    }

    default:
      return s;
  }
}

export function checkRoundEnd(state: GameState): GameState {
  if (!state.player.hasPassed || !state.ai.hasPassed) return state;

  const playerScore = getTotalScore(state.player.battlefield);
  const aiScore = getTotalScore(state.ai.battlefield);

  let roundWinner: 'player' | 'ai' | 'draw';
  let newRoundWinners = [...state.roundWinners];

  if (playerScore > aiScore) {
    roundWinner = 'player';
  } else if (aiScore > playerScore) {
    roundWinner = 'ai';
  } else {
    roundWinner = 'draw';
  }
  newRoundWinners.push(roundWinner);

  const playerRoundsWon = newRoundWinners.filter(w => w === 'player').length;
  const aiRoundsWon = newRoundWinners.filter(w => w === 'ai').length;

  // Check game over
  if (playerRoundsWon >= 2 || aiRoundsWon >= 2 || state.round >= 3) {
    const winner = playerRoundsWon > aiRoundsWon ? 'player' : aiRoundsWon > playerRoundsWon ? 'ai' : 'draw';
    return { ...state, phase: 'game-over', roundWinners: newRoundWinners, winner };
  }

  // Clear battlefield for next round
  const clearBf = (): BattlefieldState => ({ close: emptyRow(), ranged: emptyRow(), ritual: emptyRow() });

  const clearPlayer = (p: PlayerState): PlayerState => {
    const allUnits = [
      ...p.battlefield.close.units,
      ...p.battlefield.ranged.units,
      ...p.battlefield.ritual.units,
    ];
    return {
      ...p,
      battlefield: clearBf(),
      discard: [...p.discard, ...allUnits],
      hasPassed: false,
      roundsWon: roundWinner === (p === state.player ? 'player' : 'ai') ? p.roundsWon + 1 : p.roundsWon,
    };
  };

  return {
    ...state,
    player: clearPlayer(state.player),
    ai: clearPlayer(state.ai),
    round: state.round + 1,
    phase: 'battle',
    currentTurn: 'player',
    weatherEffects: { close: false, ranged: false, ritual: false },
    roundWinners: newRoundWinners,
    lastAction: roundWinner === 'draw' ? 'Even the gods hesitate.' : roundWinner === 'player' ? 'The field bends to your myth.' : 'The omen turns against you.',
  };
}

// ============================
// AI Logic
// ============================
export function aiDecide(state: GameState): GameAction {
  const ai = state.ai;
  const player = state.player;
  
  const aiScore = getTotalScore(ai.battlefield);
  const playerScore = getTotalScore(player.battlefield);
  const round = state.round;
  const roundsLeft = 3 - round;
  
  // If player has passed, play minimum to win or pass if can't win efficiently
  if (player.hasPassed) {
    if (aiScore > playerScore) {
      // Already winning - pass to preserve cards (unless round 3)
      if (round < 3 && ai.hand.length > 2) {
        return { type: 'PASS' };
      }
    }
    // Need to play to win
    const needed = playerScore - aiScore + 1;
    const cheapCard = ai.hand
      .filter(c => c.def.type === 'unit')
      .sort((a, b) => a.def.strength - b.def.strength)
      .find(c => c.def.strength >= needed);
    
    if (cheapCard && cheapCard.def.row) {
      return { type: 'PLAY_UNIT', cardInstanceId: cheapCard.instanceId, row: cheapCard.def.row as Row };
    }
    return { type: 'PASS' };
  }
  
  // Far ahead - consider passing
  if (aiScore - playerScore > 15 && ai.hand.length > 3 && round < 3) {
    return { type: 'PASS' };
  }
  
  // Use leader if not used and conditions are right
  if (!ai.leaderUsed && round === 3) {
    return { type: 'USE_LEADER' };
  }

  // Play weather if we have it and it hurts player more
  const weatherCard = ai.hand.find(c => c.def.type === 'weather');
  if (weatherCard) {
    const target = weatherCard.def.abilityData?.weatherTarget;
    if (target && target !== 'all') {
      const playerRowScore = getRowScore(player.battlefield[target as Row]);
      const aiRowScore = getRowScore(ai.battlefield[target as Row]);
      if (playerRowScore > aiRowScore + 5) {
        return { type: 'PLAY_WEATHER', cardInstanceId: weatherCard.instanceId };
      }
    }
  }

  // Play doom if player has a strong non-heroic
  const doomCard = ai.hand.find(c => c.def.ability === 'doom');
  if (doomCard) {
    const strongest = getAllNonHeroicUnits(state).filter(u => u.owner === 'player').sort((a,b) => b.unit.currentStrength - a.unit.currentStrength)[0];
    if (strongest && strongest.unit.currentStrength >= 7) {
      if (doomCard.def.type === 'special') {
        return { type: 'PLAY_SPECIAL', cardInstanceId: doomCard.instanceId };
      }
      if (doomCard.def.row) {
        return { type: 'PLAY_UNIT', cardInstanceId: doomCard.instanceId, row: doomCard.def.row as Row };
      }
    }
  }

  // Play strongest unit card
  const unitCards = ai.hand.filter(c => c.def.type === 'unit');
  if (unitCards.length > 0) {
    const best = unitCards.sort((a, b) => b.def.strength - a.def.strength)[0];
    return { type: 'PLAY_UNIT', cardInstanceId: best.instanceId, row: best.def.row as Row };
  }

  // Play special
  const special = ai.hand.find(c => c.def.type === 'special');
  if (special) {
    return { type: 'PLAY_SPECIAL', cardInstanceId: special.instanceId, targetRow: 'close' };
  }

  return { type: 'PASS' };
}

export function createInitialState(playerFaction: Faction, aiFaction: Faction): GameState {
  const aiFactions: Faction[] = ['hellenic', 'vedic', 'norse', 'slavic', 'celtic', 'egyptian'];
  const randomAI = aiFactions[Math.floor(Math.random() * aiFactions.length)];
  
  return {
    phase: 'mulligan',
    player: createPlayerState(playerFaction),
    ai: createPlayerState(aiFaction || randomAI),
    round: 1,
    currentTurn: 'player',
    weatherEffects: { close: false, ranged: false, ritual: false },
    roundWinners: [],
    mulligansLeft: 2,
    selectedFaction: playerFaction,
    winner: undefined,
  };
}
