import type { PowerUpType, ZoneConfig, ZoneId } from './types';

export const ZONES: Record<ZoneId, ZoneConfig> = {
  snow: {
    id: 'snow',
    name: 'Snow Zone',
    subtitle: 'Frozen Peaks & Ice Bridges',
    description:
      'Sprint across crystalline ice causeways flanked by frost-laden pines, glacial spires, and deep snow chasms.',
    accentHex: '#38BDF8',
    skyTopHex: 0x0e243d,
    skyHorizonHex: 0xa8d4f0,
    fogHex: 0x9acae8,
    fogDensity: 0.0115,
    hemiSkyHex: 0xd4ecff,
    hemiGroundHex: 0x3b5875,
    sunHex: 0xfff5e4,
    sunIntensity: 1.9,
    trackColorHex: 0xd9ecfa,
    trackEdgeHex: 0x7ba5c9,
    laneStripeHex: 0x9ec7e8,
    terrainHex: 0xeaf4fc,
    accentPropHex: 0x5cc4f5,
    waterOrAbyssHex: 0x163d66,
    dragonBodyHex: 0x264b73,
    dragonWingHex: 0x4ca3d9,
    dragonGlowHex: 0x7be4ff,
    ambientParticleColor: 0xffffff,
    musicProfile: 'snow',
  },
  forest: {
    id: 'forest',
    name: 'Forest Zone',
    subtitle: 'Ancient Woods & Mystic Rivers',
    description:
      'Charge through sunlit woodland trails bordered by towering oaks, rushing emerald rivers, and glowing enchanted flora.',
    accentHex: '#34D399',
    skyTopHex: 0x13352b,
    skyHorizonHex: 0x8cc9a3,
    fogHex: 0x78b891,
    fogDensity: 0.011,
    hemiSkyHex: 0xd2f5d6,
    hemiGroundHex: 0x2a4528,
    sunHex: 0xfff0c8,
    sunIntensity: 2.0,
    trackColorHex: 0x7c6248,
    trackEdgeHex: 0x486b3a,
    laneStripeHex: 0x9c8264,
    terrainHex: 0x356934,
    accentPropHex: 0x4de8a8,
    waterOrAbyssHex: 0x1b7a8a,
    dragonBodyHex: 0x1f472c,
    dragonWingHex: 0x3a8c4e,
    dragonGlowHex: 0xff8c2b,
    ambientParticleColor: 0xbef7b2,
    musicProfile: 'forest',
  },
  mountain: {
    id: 'mountain',
    name: 'Mountain Zone',
    subtitle: 'High Cliffs & Canyon Bridges',
    description:
      'Brave narrow ridge trails suspended above sweeping amber valleys, jagged basalt spires, and roaring canyon winds.',
    accentHex: '#F59E0B',
    skyTopHex: 0x281726,
    skyHorizonHex: 0xe8995a,
    fogHex: 0xd98752,
    fogDensity: 0.0105,
    hemiSkyHex: 0xffcba0,
    hemiGroundHex: 0x4a2f26,
    sunHex: 0xffd28a,
    sunIntensity: 2.2,
    trackColorHex: 0x7d6b61,
    trackEdgeHex: 0x4f3f38,
    laneStripeHex: 0xa69182,
    terrainHex: 0x6b4735,
    accentPropHex: 0xf59e0b,
    waterOrAbyssHex: 0x291614,
    dragonBodyHex: 0x5c1914,
    dragonWingHex: 0xa8381d,
    dragonGlowHex: 0xff5a1f,
    ambientParticleColor: 0xffcf87,
    musicProfile: 'mountain',
  },
};

export const ZONE_LIST: ZoneConfig[] = [ZONES.snow, ZONES.forest, ZONES.mountain];

export const POWER_UP_META: Record<
  PowerUpType,
  {
    label: string;
    title: string;
    subtitle: string;
    duration: number;
    color: string;
    hex: number;
  }
> = {
  fire: {
    label: 'Fire Shield',
    title: 'Fire Fruit Collected!',
    subtitle: 'Blazing aura — smashes obstacles & resists dragon fire',
    duration: 8.5,
    color: '#F97316',
    hex: 0xf97316,
  },
  ice: {
    label: 'Frost Slow',
    title: 'Ice Fruit Collected!',
    subtitle: 'Time frost — slows obstacles & widens reaction window',
    duration: 8.0,
    color: '#38BDF8',
    hex: 0x38bdf8,
  },
  lightning: {
    label: 'Storm Surge',
    title: 'Lightning Fruit Collected!',
    subtitle: 'Hyper speed boost & invincible storm dash',
    duration: 6.5,
    color: '#FACC15',
    hex: 0xfacc15,
  },
  golden: {
    label: 'Gold Magnet',
    title: 'Golden Fruit Collected!',
    subtitle: 'Pulls nearby coins & fruits straight to you',
    duration: 9.5,
    color: '#F59E0B',
    hex: 0xf59e0b,
  },
  shield: {
    label: 'Magic Shield',
    title: 'Magic Shield Fruit!',
    subtitle: 'Protects against one obstacle impact',
    duration: 20.0,
    color: '#A855F7',
    hex: 0xa855f7,
  },
};
