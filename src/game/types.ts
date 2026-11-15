export type ZoneId = 'snow' | 'forest' | 'mountain';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'catching' | 'gameover';

export type PowerUpType = 'fire' | 'ice' | 'lightning' | 'golden' | 'shield';

export type ObstacleKind =
  | 'cliff_gap'
  | 'fallen_log'
  | 'giant_dragon'
  | 'large_rock'
  | 'broken_bridge'
  | 'moving_hazard'
  | 'overhead_arch'
  | 'large_tree';

export type CollectibleKind =
  | 'coin'
  | 'apple'
  | 'banana'
  | 'crown'
  | 'fruit_fire'
  | 'fruit_ice'
  | 'fruit_lightning'
  | 'fruit_golden'
  | 'fruit_shield';

export interface ActivePowerUp {
  type: PowerUpType;
  label: string;
  remaining: number; // seconds, or 1 for single-use shield
  duration: number;
  color: string;
}

export interface PowerUpToast {
  id: number;
  type: PowerUpType;
  title: string;
  subtitle: string;
  color: string;
}

export interface GameSettings {
  dragonEnabled: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number; // 0 to 1
  sfxVolume: number; // 0 to 1
  showTouchControls: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  zone: ZoneId;
  score: number;
  coins: number;
  fruitsCollected: number;
  distance: number;
  highScore: number;
  speedMultiplier: number;
  dragonDistance: number; // meters behind knight (0 = caught)
  activePowerUps: ActivePowerUp[];
  gameOverReason: string;
  caughtByDragon: boolean;
}

export interface ZoneConfig {
  id: ZoneId;
  name: string;
  subtitle: string;
  description: string;
  accentHex: string;
  skyTopHex: number;
  skyHorizonHex: number;
  fogHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  sunHex: number;
  sunIntensity: number;
  trackColorHex: number;
  trackEdgeHex: number;
  laneStripeHex: number;
  terrainHex: number;
  accentPropHex: number;
  waterOrAbyssHex: number;
  dragonBodyHex: number;
  dragonWingHex: number;
  dragonGlowHex: number;
  ambientParticleColor: number;
  musicProfile: 'snow' | 'forest' | 'mountain';
}
