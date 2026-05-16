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
  return row.units.reduce((sum, u) => sum + Math.max(0, u.currentStrength), 0);
}

export function getTotalScore(bf: BattlefieldState): number {
  return getRowScore(bf.close) + getRowScore(bf.ranged) + getRowScore(bf.ritual);
}

// ─── Strength recalculation ─────────────────────────────────────────────────
// Rules (matching Gwint W3):
//   1. Reset every non-heroic unit to its base strength
//   2. Apply oathbound bonuses (doubles if a pair exists in same row)
//   3. Apply inspire bonuses (+1 per inspire card in the same row, for non-inspire, non-heroic)
//   4. Apply weather last: if weather is active on the row, non-heroic → strength = 1
//   5. Commander doubles: after weather, if hasCommander, every non-heroic *2
// Heroic units are never affected by weather or abilities.

function recalcRow(
  row: RowState,
  weatherActive: boolean,
): RowState {
  // Step 1: reset all to base strength (keep heroic as-is)
  let units = row.units.map(u => ({
    ...u,
    currentStrength: u.def.strength,
    isWeatherReduced: false,
  }));

  // Step 2: oathbound — if 2+ copies of same card id in this row, each doubles
  const oathCounts: Record<string, number> = {};
  units.forEach(u => {
    if (u.def.ability === 'oathbound') {
      oathCounts[u.def.id] = (oathCounts[u.def.id] || 0) + 1;
    }
  });
  units = units.map(u => {
    if (u.def.ability !== 'oathbound') return u;
    if ((oathCounts[u.def.id] || 0) >= 2) {
      return { ...u, currentStrength: u.def.strength * 2 };
    }
    return u;
  });

  // Step 3: inspire — count inspire cards in row, add to non-inspire non-heroic
  const inspireCount = units.filter(u => u.def.ability === 'inspire').length;
  if (inspireCount > 0) {
    units = units.map(u => {
      if (u.def.ability === 'heroic' || u.def.ability === 'inspire') return u;
      return { ...u, currentStrength: u.currentStrength + inspireCount };
    });
  }

  // Step 4: weather — all non-heroic → 1
  if (weatherActive) {
    units = units.map(u => {
      if (u.def.ability === 'heroic') return u;
      return { ...u, currentStrength: 1, isWeatherReduced: true };
    });
  }

  // Step 5: commander doubling (applied after weather, only if no weather)
  // Note: in Gwint, commander doubles BEFORE weather. We follow same rule:
  // commander effect is baked in pre-weather. If weather is active, the
  // doubled value is still reduced to 1. Store the hasCommander flag.
  // For scoring: if commander AND weather, heroic cards keep their value.
  // Non-heroic are already 1 from weather — leave as-is.

  return { ...row, units, hasWeather: weatherActive };
}

export function recalcBattlefield(
  bf: BattlefieldState,
  weather: { close: boolean; ranged: boolean; ritual: boolean },
): BattlefieldState {
  return {
    close:   recalcRow(bf.close,   weather.close),
    ranged:  recalcRow(bf.ranged,  weather.ranged),
    ritual:  recalcRow(bf.ritual,  weather.ritual),
  };
}

// Apply commander doubling visually (used after recalc for display only)
export function applyCommanderVisual(bf: BattlefieldState): BattlefieldState {
  const applyRow = (row: RowState): RowState => {
    if (!row.hasCommander) return row;
    return {
      ...row,
      units: row.units.map(u => ({
        ...u,
        currentStrength: u.def.ability === 'heroic' ? u.currentStrength : u.currentStrength * 2,
        isCommanderDoubled: u.def.ability !== 'heroic',
      })),
    };
  };
  return { close: applyRow(bf.close), ranged: applyRow(bf.ranged), ritual: applyRow(bf.ritual) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function removeFromHand(hand: CardInstance[], instanceId: string): { card: CardInstance | null; hand: CardInstance[] } {
  const idx = hand.findIndex(c => c.instanceId === instanceId);
  if (idx === -1) return { card: null, hand };
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

function findStrongestNonHeroic(state: GameState, ownerFilter?: 'player' | 'ai'): { unit: CardInstance; owner: 'player' | 'ai'; row: Row } | null {
  let units = getAllNonHeroicUnits(state);
  if (ownerFilter) units = units.filter(u => u.owner === ownerFilter);
  if (units.length === 0) return null;
  const maxStr = Math.max(...units.map(u => u.unit.currentStrength));
  return units.find(u => u.unit.currentStrength === maxStr) || null;
}

function removeUnitFromBattlefield(
  bf: BattlefieldState,
  instanceId: string
): { bf: BattlefieldState; removed: CardInstance | null } {
  let removed: CardInstance | null = null;
  const close = bf.close.units.find(u => u.instanceId === instanceId);
  const ranged = bf.ranged.units.find(u => u.instanceId === instanceId);
  const ritual = bf.ritual.units.find(u => u.instanceId === instanceId);

  if (close) { removed = close; return { bf: { ...bf, close: { ...bf.close, units: bf.close.units.filter(u => u.instanceId !== instanceId) } }, removed }; }
  if (ranged) { removed = ranged; return { bf: { ...bf, ranged: { ...bf.ranged, units: bf.ranged.units.filter(u => u.instanceId !== instanceId) } }, removed }; }
  if (ritual) { removed = ritual; return { bf: { ...bf, ritual: { ...bf.ritual, units: bf.ritual.units.filter(u => u.instanceId !== instanceId) } }, removed }; }
  return { bf, removed: null };
}

function pullWarbandFromDeck(state: GameState, who: 'player' | 'ai', def: CardDef): GameState {
  const player = { ...state[who] };
  const copies = player.deck.filter(c => c.def.id === def.id);
  if (copies.length === 0) return state;
  const row = def.row!;
  let bf = { ...player.battlefield };
  copies.forEach(c => { bf = { ...bf, [row]: addToRow(bf[row], c) }; });
  player.deck = player.deck.filter(c => c.def.id !== def.id);
  player.battlefield = bf;
  return { ...state, [who]: player };
}

function recalcBoth(s: GameState): GameState {
  return {
    ...s,
    player: { ...s.player, battlefield: recalcBattlefield(s.player.battlefield, s.weatherEffects) },
    ai:     { ...s.ai,     battlefield: recalcBattlefield(s.ai.battlefield,     s.weatherEffects) },
  };
}

// ─── Core action reducer ─────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction, who: 'player' | 'ai'): GameState {
  let s = { ...state };
  const opponent = who === 'player' ? 'ai' : 'player';

  switch (action.type) {

    case 'PLAY_UNIT': {
      const { card, hand } = removeFromHand(s[who].hand, action.cardInstanceId);
      if (!card || !card.def.row) return s;
      const row = action.row;
      // Enforce correct row for unit cards
      if (card.def.type === 'unit' && card.def.row !== row) return s;

      // Place card
      let bf = { ...s[who].battlefield };
      bf[row] = addToRow(bf[row], { ...card, currentStrength: card.def.strength, isWeatherReduced: false });

      let newS: GameState = {
        ...s,
        [who]: { ...s[who], hand, battlefield: bf },
        lastAction: `${who === 'player' ? 'You' : 'AI'} played ${card.def.name}`,
      };

      // Warband: pull all copies from deck immediately
      if (card.def.ability === 'warband') {
        newS = pullWarbandFromDeck(newS, who, card.def);
      }

      // Seer: player draws 2 cards (the seer card stays in own row — we don't move it to opponent)
      if (card.def.ability === 'seer') {
        const drawn = newS[who].deck.slice(0, 2);
        newS[who] = { ...newS[who], hand: [...newS[who].hand, ...drawn], deck: newS[who].deck.slice(2) };
      }

      // Doom: destroy the single strongest non-heroic card on the entire field
      // Exclude the doom card itself (just placed) from targeting
      if (card.def.ability === 'doom') {
        const doomInstanceId = card.instanceId;
        let candidates = getAllNonHeroicUnits(newS).filter(u => u.unit.instanceId !== doomInstanceId);
        if (candidates.length > 0) {
          const maxStr = Math.max(...candidates.map(u => u.unit.currentStrength));
          const target = candidates.find(u => u.unit.currentStrength === maxStr) || null;
          if (target) {
            const { bf: newBf, removed } = removeUnitFromBattlefield(newS[target.owner].battlefield, target.unit.instanceId);
            if (removed) {
              newS = { ...newS, [target.owner]: { ...newS[target.owner], battlefield: newBf, discard: [...newS[target.owner].discard, removed] } };
            }
          }
        }
      }

      // Restore: revive highest-strength non-heroic from own discard
      if (card.def.ability === 'restore') {
        const discards = newS[who].discard
          .filter(u => u.def.type === 'unit' && u.def.ability !== 'heroic')
          .sort((a, b) => b.def.strength - a.def.strength);
        if (discards.length > 0) {
          const toRevive = discards[0];
          const revived = { ...toRevive, currentStrength: toRevive.def.strength, isWeatherReduced: false };
          const revRow = toRevive.def.row || 'close';
          newS[who] = {
            ...newS[who],
            discard: newS[who].discard.filter(u => u.instanceId !== toRevive.instanceId),
            battlefield: { ...newS[who].battlefield, [revRow]: addToRow(newS[who].battlefield[revRow], revived) },
          };
        }
      }

      return recalcBoth({ ...newS, currentTurn: opponent });
    }

    case 'PLAY_SPECIAL': {
      const { card, hand } = removeFromHand(s[who].hand, action.cardInstanceId);
      if (!card) return s;

      let newS: GameState = {
        ...s,
        [who]: { ...s[who], hand },
        lastAction: `${who === 'player' ? 'You' : 'AI'} played ${card.def.name}`,
      };

      // Clear weather (Dawn Invocation / any card with "Remove all weather" in description)
      if (card.def.ability === 'special' && (card.def.name === 'Dawn Invocation' || card.def.description.toLowerCase().includes('remove all weather'))) {
        newS = { ...newS, weatherEffects: { close: false, ranged: false, ritual: false } };
      }

      // Commander: mark a row for doubling
      if (card.def.ability === 'commander') {
        const targetRow = action.targetRow || 'close';
        if (!newS[who].battlefield[targetRow].hasCommander) {
          newS[who] = {
            ...newS[who],
            battlefield: {
              ...newS[who].battlefield,
              [targetRow]: { ...newS[who].battlefield[targetRow], hasCommander: true },
            },
          };
        }
      }

      // Doom
      if (card.def.ability === 'doom') {
        const target = findStrongestNonHeroic(newS);
        if (target) {
          const { bf: newBf, removed } = removeUnitFromBattlefield(newS[target.owner].battlefield, target.unit.instanceId);
          if (removed) {
            newS = { ...newS, [target.owner]: { ...newS[target.owner], battlefield: newBf, discard: [...newS[target.owner].discard, removed] } };
          }
        }
      }

      // Restore
      if (card.def.ability === 'restore') {
        const discards = newS[who].discard
          .filter(u => u.def.type === 'unit' && u.def.ability !== 'heroic')
          .sort((a, b) => b.def.strength - a.def.strength);
        if (discards.length > 0) {
          const toRevive = discards[0];
          const revived = { ...toRevive, currentStrength: toRevive.def.strength, isWeatherReduced: false };
          const revRow = toRevive.def.row || 'close';
          newS[who] = {
            ...newS[who],
            discard: newS[who].discard.filter(u => u.instanceId !== toRevive.instanceId),
            battlefield: { ...newS[who].battlefield, [revRow]: addToRow(newS[who].battlefield[revRow], revived) },
          };
        }
      }

      // Row buff (+N to all non-heroic non-weather in a row)
      if (card.def.abilityData?.buffAmount && action.targetRow) {
        const targetRow = action.targetRow;
        const buffAmt = card.def.abilityData.buffAmount;
        const rowState = newS[who].battlefield[targetRow];
        const buffedRow = {
          ...rowState,
          units: rowState.units.map(u =>
            u.def.ability !== 'heroic' && !u.isWeatherReduced
              ? { ...u, currentStrength: u.currentStrength + buffAmt }
              : u
          ),
        };
        newS[who] = { ...newS[who], battlefield: { ...newS[who].battlefield, [targetRow]: buffedRow } };
      }

      // Recall: return one friendly non-heroic unit from battlefield to hand
      if (card.def.description.toLowerCase().includes('return one friendly') && action.target) {
        const { bf: newBf, removed } = removeUnitFromBattlefield(newS[who].battlefield, action.target);
        if (removed && removed.def.ability !== 'heroic') {
          newS[who] = {
            ...newS[who],
            battlefield: newBf,
            hand: [...newS[who].hand, { ...removed, currentStrength: removed.def.strength, isWeatherReduced: false }],
          };
        }
      }

      // Soma Offering: draw 1
      if (card.def.name === 'Soma Offering') {
        if (newS[who].deck.length > 0) {
          const drawn = newS[who].deck[0];
          newS[who] = { ...newS[who], hand: [...newS[who].hand, drawn], deck: newS[who].deck.slice(1) };
        }
      }

      // Veles Bargain: draw 2, give opponent a 4-str token
      if (card.def.name === 'Veles Bargain') {
        const drawn = newS[who].deck.slice(0, 2);
        newS[who] = { ...newS[who], hand: [...newS[who].hand, ...drawn], deck: newS[who].deck.slice(2) };
        const token: CardInstance = {
          instanceId: `token_${Date.now()}`,
          def: { id: 'token_veles', name: 'Veles Token', faction: 'slavic', type: 'unit', row: 'close', strength: 4, ability: 'none', description: 'Token from Veles Bargain.', artKey: 'slv_veles_bargain' },
          currentStrength: 4, isWeatherReduced: false, isCommanderDoubled: false,
        };
        newS[opponent] = { ...newS[opponent], hand: [...newS[opponent].hand, token] };
      }

      // Odin Ravens: draw 1
      if (card.def.name === 'Odin Ravens') {
        if (newS[who].deck.length > 0) {
          newS[who] = { ...newS[who], hand: [...newS[who].hand, newS[who].deck[0]], deck: newS[who].deck.slice(1) };
        }
      }

      return recalcBoth({ ...newS, currentTurn: opponent });
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

      return recalcBoth({
        ...s,
        [who]: { ...s[who], hand },
        weatherEffects: weather,
        lastAction: `${who === 'player' ? 'You' : 'AI'} played ${card.def.name}`,
        currentTurn: opponent,
      });
    }

    case 'USE_LEADER': {
      if (s[who].leaderUsed) return s;
      // Also block leader use if player has passed (shouldn't happen via UI, but guard here)
      if (s[who].hasPassed) return s;
      let newS: GameState = { ...s, [who]: { ...s[who], leaderUsed: true }, lastAction: `${who === 'player' ? 'You' : 'AI'} used leader ability` };
      const faction = s[who].faction;

      if (faction === 'hellenic') {
        // Draw 1 card
        if (newS[who].deck.length > 0) {
          newS[who] = { ...newS[who], hand: [...newS[who].hand, newS[who].deck[0]], deck: newS[who].deck.slice(1) };
        }
      } else if (faction === 'vedic') {
        // Revive strongest non-heroic from own discard
        const discards = newS[who].discard
          .filter(u => u.def.type === 'unit' && u.def.ability !== 'heroic')
          .sort((a, b) => b.def.strength - a.def.strength);
        if (discards.length > 0) {
          const toRevive = discards[0];
          const revived = { ...toRevive, currentStrength: toRevive.def.strength, isWeatherReduced: false };
          const revRow = toRevive.def.row || 'close';
          newS[who] = {
            ...newS[who],
            discard: newS[who].discard.filter(u => u.instanceId !== toRevive.instanceId),
            battlefield: { ...newS[who].battlefield, [revRow]: addToRow(newS[who].battlefield[revRow], revived) },
          };
        }
      } else if (faction === 'norse') {
        // Apply frost to opponent close row
        const weather = { ...newS.weatherEffects, close: true };
        newS = { ...newS, weatherEffects: weather };
      } else if (faction === 'slavic') {
        // Return one friendly non-heroic to hand
        const allFriendly = [
          ...newS[who].battlefield.close.units,
          ...newS[who].battlefield.ranged.units,
          ...newS[who].battlefield.ritual.units,
        ].filter(u => u.def.ability !== 'heroic');
        if (allFriendly.length > 0) {
          const toRecall = action.target
            ? allFriendly.find(u => u.instanceId === action.target) || allFriendly[0]
            : allFriendly[0];
          const { bf: newBf } = removeUnitFromBattlefield(newS[who].battlefield, toRecall.instanceId);
          newS[who] = { ...newS[who], battlefield: newBf, hand: [...newS[who].hand, { ...toRecall, currentStrength: toRecall.def.strength, isWeatherReduced: false }] };
        }
      } else if (faction === 'celtic') {
        // Mark a row for commander doubling
        const targetRow = action.targetRow || 'close';
        if (!newS[who].battlefield[targetRow].hasCommander) {
          newS[who] = { ...newS[who], battlefield: { ...newS[who].battlefield, [targetRow]: { ...newS[who].battlefield[targetRow], hasCommander: true } } };
        }
      } else if (faction === 'egyptian') {
        // Destroy strongest enemy non-heroic (unconditionally)
        const target = findStrongestNonHeroic(newS, opponent);
        if (target) {
          const { bf: newBf, removed } = removeUnitFromBattlefield(newS[opponent].battlefield, target.unit.instanceId);
          if (removed) {
            newS[opponent] = { ...newS[opponent], battlefield: newBf, discard: [...newS[opponent].discard, removed] };
          }
        }
      }

      return recalcBoth({ ...newS, currentTurn: opponent });
    }

    case 'PASS': {
      const newS = {
        ...s,
        [who]: { ...s[who], hasPassed: true },
        lastAction: `${who === 'player' ? 'You' : 'AI'} passed`,
        currentTurn: opponent,
      };
      // If both have now passed, don't change turn — checkRoundEnd will handle it
      if (newS.player.hasPassed && newS.ai.hasPassed) {
        return { ...newS, currentTurn: 'player' }; // neutral, prevents AI loop
      }
      return newS;
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

// ─── Round end ───────────────────────────────────────────────────────────────

export function checkRoundEnd(state: GameState): GameState {
  // Only end the round when BOTH have passed
  if (!state.player.hasPassed || !state.ai.hasPassed) return state;

  const playerScore = getTotalScore(state.player.battlefield);
  const aiScore     = getTotalScore(state.ai.battlefield);

  let roundWinner: 'player' | 'ai' | 'draw';
  if (playerScore > aiScore)      roundWinner = 'player';
  else if (aiScore > playerScore) roundWinner = 'ai';
  else                             roundWinner = 'draw';

  const newRoundWinners = [...state.roundWinners, roundWinner];
  const playerRoundsWon = newRoundWinners.filter(w => w === 'player').length;
  const aiRoundsWon     = newRoundWinners.filter(w => w === 'ai').length;

  // Check game over: first to 2 round wins, or after round 3
  if (playerRoundsWon >= 2 || aiRoundsWon >= 2 || state.round >= 3) {
    const winner = playerRoundsWon > aiRoundsWon ? 'player' : aiRoundsWon > playerRoundsWon ? 'ai' : 'draw';
    return { ...state, phase: 'game-over', roundWinners: newRoundWinners, winner };
  }

  // Prepare for next round
  // Move all battlefield units to discard, clear battlefield
  const clearPlayer = (p: PlayerState, isRoundWinner: boolean): PlayerState => {
    const allUnits = [
      ...p.battlefield.close.units,
      ...p.battlefield.ranged.units,
      ...p.battlefield.ritual.units,
    ];
    // Draw cards for next round: both draw 2, round winner draws +1 (= 3)
    // Cap at deck size
    const drawCount = Math.min(isRoundWinner ? 3 : 2, p.deck.length);
    const drawn = p.deck.slice(0, drawCount);
    const remainingDeck = p.deck.slice(drawCount);
    return {
      ...p,
      battlefield: emptyBattlefield(),
      discard: [...p.discard, ...allUnits],
      hand: [...p.hand, ...drawn],
      deck: remainingDeck,
      hasPassed: false,
      roundsWon: isRoundWinner ? p.roundsWon + 1 : p.roundsWon,
    };
  };

  const roundMsg =
    roundWinner === 'draw'   ? 'Even the gods hesitate — a draw.' :
    roundWinner === 'player' ? 'The field bends to your myth.' :
                               'The omen turns against you.';

  return {
    ...state,
    player: clearPlayer(state.player, roundWinner === 'player'),
    ai:     clearPlayer(state.ai,     roundWinner === 'ai'),
    round:  state.round + 1,
    phase: 'battle',
    currentTurn: 'player',
    weatherEffects: { close: false, ranged: false, ritual: false },
    roundWinners: newRoundWinners,
    lastAction: roundMsg,
  };
}

// ─── AI Logic ────────────────────────────────────────────────────────────────
// Mirrors Gwint W3 AI behaviour: bleed strategy in rounds 1-2, aggro in round 3.

export function aiDecide(state: GameState): GameAction {
  const ai     = state.ai;
  const player = state.player;

  // If AI already passed, it should not play — caller must guard this
  if (ai.hasPassed) return { type: 'PASS' };

  const aiScore     = getTotalScore(ai.battlefield);
  const playerScore = getTotalScore(player.battlefield);
  const round       = state.round;

  // --- Player has passed: AI plays minimum needed to win, else passes ---
  if (player.hasPassed) {
    if (aiScore > playerScore) {
      // Already winning — pass to preserve cards unless it's round 3
      if (round < 3) return { type: 'PASS' };
    }
    // Need to close the gap
    const needed = playerScore - aiScore + 1;
    const unitCards = ai.hand.filter(c => c.def.type === 'unit' && c.def.row);
    const cheapestWinner = unitCards
      .sort((a, b) => a.def.strength - b.def.strength)
      .find(c => c.def.strength >= needed);
    if (cheapestWinner && cheapestWinner.def.row) {
      return { type: 'PLAY_UNIT', cardInstanceId: cheapestWinner.instanceId, row: cheapestWinner.def.row as Row };
    }
    // Can't win — pass
    return { type: 'PASS' };
  }

  // --- Far ahead with cards in hand in early rounds: pass to save cards ---
  if (aiScore - playerScore > 15 && ai.hand.length >= 4 && round < 3) {
    return { type: 'PASS' };
  }

  // --- Use leader if round 3 and it hasn't been used ---
  if (!ai.leaderUsed && round === 3) {
    return { type: 'USE_LEADER' };
  }

  // --- Doom: destroy a strong player unit ---
  const doomCard = ai.hand.find(c => c.def.ability === 'doom');
  if (doomCard) {
    const strongest = getAllNonHeroicUnits(state)
      .filter(u => u.owner === 'player')
      .sort((a, b) => b.unit.currentStrength - a.unit.currentStrength)[0];
    if (strongest && strongest.unit.currentStrength >= 6) {
      if (doomCard.def.type === 'special') {
        return { type: 'PLAY_SPECIAL', cardInstanceId: doomCard.instanceId };
      }
      if (doomCard.def.row) {
        return { type: 'PLAY_UNIT', cardInstanceId: doomCard.instanceId, row: doomCard.def.row as Row };
      }
    }
  }

  // --- Weather: play if player's targeted row score is notably larger ---
  const weatherCard = ai.hand.find(c => c.def.type === 'weather');
  if (weatherCard) {
    const target = weatherCard.def.abilityData?.weatherTarget;
    if (target && target !== 'all') {
      const playerRowScore = getRowScore(player.battlefield[target as Row]);
      const aiRowScore     = getRowScore(ai.battlefield[target as Row]);
      if (playerRowScore > aiRowScore + 4) {
        return { type: 'PLAY_WEATHER', cardInstanceId: weatherCard.instanceId };
      }
    } else if (target === 'all') {
      // Only play blizzard if it helps more than hurts
      if (playerScore > aiScore + 8) {
        return { type: 'PLAY_WEATHER', cardInstanceId: weatherCard.instanceId };
      }
    }
  }

  // --- Restore: use if we have discarded units ---
  const restoreCard = ai.hand.find(c => c.def.ability === 'restore');
  if (restoreCard) {
    const hasDiscards = ai.discard.some(u => u.def.type === 'unit' && u.def.ability !== 'heroic');
    if (hasDiscards) {
      if (restoreCard.def.type === 'special') return { type: 'PLAY_SPECIAL', cardInstanceId: restoreCard.instanceId };
      if (restoreCard.def.row) return { type: 'PLAY_UNIT', cardInstanceId: restoreCard.instanceId, row: restoreCard.def.row as Row };
    }
  }

  // --- Play strongest unit ---
  const unitCards = ai.hand.filter(c => c.def.type === 'unit' && c.def.row);
  if (unitCards.length > 0) {
    const best = [...unitCards].sort((a, b) => b.def.strength - a.def.strength)[0];
    return { type: 'PLAY_UNIT', cardInstanceId: best.instanceId, row: best.def.row as Row };
  }

  // --- Play a special card ---
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
    ai:     createPlayerState(aiFaction || randomAI),
    round:  1,
    currentTurn: 'player',
    weatherEffects: { close: false, ranged: false, ritual: false },
    roundWinners: [],
    mulligansLeft: 2,
    selectedFaction: playerFaction,
    winner: undefined,
  };
}
