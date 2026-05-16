export interface FactionInfo {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  playstyle: string;
  leaderName: string;
  leaderAbility: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    text: string;
  };
  emoji: string;
}

export const FACTIONS: Record<string, FactionInfo> = {
  hellenic: {
    id: 'hellenic',
    name: 'Hellenic Olympians',
    subtitle: 'Greek / Roman',
    description: 'Disciplined, heroic, and balanced. Bronze-shield soldiers, marble temples, thunderclouds, and divine judgment.',
    playstyle: 'Balanced and reliable. Strong Close Row, good Inspire effects, strong Heroic cards.',
    leaderName: 'Oracle of the Acropolis',
    leaderAbility: 'Once per match, reveal two random cards from the opponent\'s hand, then draw one card.',
    colors: {
      primary: '#C8860A',
      secondary: '#1A3A6E',
      accent: '#E8C870',
      bg: '#1C1810',
      text: '#F5E8C0',
    },
    emoji: '⚡',
  },
  vedic: {
    id: 'vedic',
    name: 'Vedic Devas',
    subtitle: 'Indian Mythology',
    description: 'Mystical, radiant, and combo-focused. Sacred fire, divine weapons, sages, and monsoon storms.',
    playstyle: 'Synergy and recovery. Strong Ranged and Ritual rows, excellent Restore effects.',
    leaderName: 'Rishi of the Sacred Flame',
    leaderAbility: 'Revive one non-Heroic unit from your discard pile.',
    colors: {
      primary: '#B8320A',
      secondary: '#2D1A6E',
      accent: '#F0A830',
      bg: '#1A1018',
      text: '#F8E8D0',
    },
    emoji: '🔥',
  },
  norse: {
    id: 'norse',
    name: 'Northern Aesir',
    subtitle: 'Norse / Viking',
    description: 'Aggressive, brutal, and row-pressure focused. Berserkers, raiders, giants, wolves, and apocalyptic weather.',
    playstyle: 'Aggression and Close Row dominance. Very strong Close Row, strong Warband cards.',
    leaderName: 'Seer of the World Tree',
    leaderAbility: 'Apply frost to the enemy Close Row.',
    colors: {
      primary: '#1A4A8E',
      secondary: '#2A2A2A',
      accent: '#60C8F0',
      bg: '#0C1018',
      text: '#E0F0FF',
    },
    emoji: '🐺',
  },
  slavic: {
    id: 'slavic',
    name: 'Spirits of the Old Forest',
    subtitle: 'Slavic Folklore',
    description: 'Strange, wild, eerie, and tricky. Forest spirits, witches, household gods, bog creatures, and dark bargains.',
    playstyle: 'Control and disruption. Good removal, recall tricks, revive effects.',
    leaderName: 'Keeper of the Threshold',
    leaderAbility: 'Return one friendly non-Heroic unit from the battlefield to your hand.',
    colors: {
      primary: '#1A5A28',
      secondary: '#3A1818',
      accent: '#B04040',
      bg: '#0C1808',
      text: '#D8F0D0',
    },
    emoji: '🌲',
  },
  celtic: {
    id: 'celtic',
    name: 'The Sidhe Courts',
    subtitle: 'Celtic Mythology',
    description: 'Elegant, deceptive, and flexible. Fairy knights, druids, bards, standing stones, and moonlit magic.',
    playstyle: 'Flexible tactics and row enhancement. Strong Ranged Row, excellent Commander effects.',
    leaderName: 'Bard of the Hollow Hill',
    leaderAbility: 'Double the strength of one friendly row.',
    colors: {
      primary: '#1A5A38',
      secondary: '#304060',
      accent: '#80C898',
      bg: '#0C1810',
      text: '#D0F8E8',
    },
    emoji: '🌙',
  },
  egyptian: {
    id: 'egyptian',
    name: 'The Ennead',
    subtitle: 'Egyptian Mythology',
    description: 'Slow, powerful, and inevitable. Tomb guardians, priests, scarabs, solar power, and underworld resurrection.',
    playstyle: 'Late-game control and Ritual/Siege strength. Strong Restore effects, comeback tools.',
    leaderName: 'Scribe of the Weighing Hall',
    leaderAbility: 'If your total score is lower than your opponent\'s, destroy the strongest enemy non-Heroic unit.',
    colors: {
      primary: '#8A6A00',
      secondary: '#1A1830',
      accent: '#FFD040',
      bg: '#181410',
      text: '#FFF0C0',
    },
    emoji: '☀️',
  },
};
