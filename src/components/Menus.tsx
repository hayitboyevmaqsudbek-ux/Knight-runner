import {
  Check,
  Coins,
  Compass,
  Flame,
  Mountain,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Snowflake,
  Trees,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import type { GameSettings, HudSnapshot, ZoneId } from '../game/types';
import { ZONE_LIST, ZONES } from '../game/zones';

interface MainMenuProps {
  hud: HudSnapshot;
  settings: GameSettings;
  onPlay: () => void;
  onOpenZones: () => void;
  onOpenSettings: () => void;
  onToggleDragon: () => void;
}

export function MainMenu({
  hud,
  settings,
  onPlay,
  onOpenZones,
  onOpenSettings,
  onToggleDragon,
}: MainMenuProps) {
  const activeZone = ZONES[hud.zone];

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-5 sm:p-8 pointer-events-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 pointer-events-auto">
        <div className="rounded-xl bg-slate-950/90 border border-white/12 px-4 py-2.5 flex items-center gap-4">
          <span className="font-display text-lg sm:text-xl font-bold tracking-wide text-white whitespace-nowrap">
            Knight&apos;s Dragon Run
          </span>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="hidden sm:inline text-sm font-medium text-slate-300 whitespace-nowrap">
            {activeZone.name}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {hud.highScore > 0 && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-950/90 border border-white/12 px-3.5 py-2.5 text-sm font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="font-mono-num">{hud.highScore.toLocaleString()}</span>
            </div>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 rounded-xl bg-slate-950/90 border border-white/12 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-white/30 hover:bg-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Settings className="w-4 h-4" />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>

      {/* Bottom Docked Primary Action Bar (keeps center 3D knight & dragon unobstructed!) */}
      <div className="pointer-events-auto mx-auto w-full max-w-2xl rounded-2xl bg-slate-950/92 border border-white/12 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Outrun the Dragon Across Three Realms
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Leap broken bridges, slide under arches, gather magical fruits, and survive the chase.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-lg font-bold py-3.5 px-6 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>PLAY</span>
          </button>

          <button
            type="button"
            onClick={onOpenZones}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-white font-display text-base font-bold py-3.5 px-5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Compass className="w-5 h-5 text-sky-400" />
            <span>ZONALAR</span>
          </button>

          <button
            type="button"
            onClick={onToggleDragon}
            className={`flex items-center justify-center gap-2 rounded-xl border font-semibold text-sm py-3.5 px-4 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              settings.dragonEnabled
                ? 'bg-red-950/85 border-red-500/45 text-red-100 hover:bg-red-900/80'
                : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Flame
              className={`w-4 h-4 shrink-0 ${
                settings.dragonEnabled ? 'text-red-400' : 'text-slate-500'
              }`}
            />
            <span>Dragon: {settings.dragonEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>PC: Left / Right to Steer · Space to Jump · Down to Slide · Esc to Pause</span>
          <span>Mobile: Swipe Left / Right / Up / Down</span>
        </div>
      </div>
    </div>
  );
}

interface ZoneModalProps {
  selectedZone: ZoneId;
  onSelectZone: (zone: ZoneId) => void;
  onClose: () => void;
}

export function ZoneModal({ selectedZone, onSelectZone, onClose }: ZoneModalProps) {
  const iconFor = (id: ZoneId) => {
    if (id === 'snow') return <Snowflake className="w-6 h-6 text-sky-400" />;
    if (id === 'forest') return <Trees className="w-6 h-6 text-emerald-400" />;
    return <Mountain className="w-6 h-6 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-950 border border-white/15 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">ZONALAR — Select Realm</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Each zone transforms the 3D terrain, obstacles, dragon scale colors, and music.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Zones"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-white/25 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {ZONE_LIST.map((z) => {
            const active = z.id === selectedZone;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => {
                  onSelectZone(z.id);
                  onClose();
                }}
                className={`text-left rounded-xl p-4 border transition-colors cursor-pointer flex flex-col justify-between gap-4 ${
                  active
                    ? 'bg-slate-900 border-amber-400 shadow-lg'
                    : 'bg-slate-900/60 border-white/10 hover:border-white/25 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center">
                      {iconFor(z.id)}
                    </div>
                    {active && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                        <Check className="w-4 h-4" />
                        Selected
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-white mt-3">{z.name}</h3>
                  <div className="text-xs font-medium text-slate-400 mt-0.5">{z.subtitle}</div>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2.5">{z.description}</p>
                </div>

                <div
                  className="h-1.5 w-full rounded-full"
                  style={{ backgroundColor: z.accentHex }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-white/15 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <h2 className="font-display text-2xl font-bold text-white">SETTINGS</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-white/25 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mt-5">
          {/* Chasing Dragon ON/OFF */}
          <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900 border border-white/10 p-4">
            <div className="flex items-start gap-3">
              <Flame className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">Chasing Dragon</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  When ON, a giant dragon chases behind the knight and catches you on impact or fall.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...settings, dragonEnabled: !settings.dragonEnabled })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                settings.dragonEnabled
                  ? 'bg-red-500 text-white hover:bg-red-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {settings.dragonEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Background Music */}
          <div className="rounded-xl bg-slate-900 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-5 h-5 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold text-white">Zone Music</span>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...settings, musicEnabled: !settings.musicEnabled })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  settings.musicEnabled
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {settings.musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => onChange({ ...settings, musicVolume: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Music Volume"
            />
          </div>

          {/* Sound Effects */}
          <div className="rounded-xl bg-slate-900 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-white">Sound Effects</span>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...settings, sfxEnabled: !settings.sfxEnabled })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  settings.sfxEnabled
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {settings.sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => onChange({ ...settings, sfxVolume: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Sound Effects Volume"
            />
          </div>

          {/* Mobile Touch Buttons */}
          <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900 border border-white/10 p-4">
            <div>
              <div className="text-sm font-semibold text-white">On-Screen Mobile Buttons</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Show directional buttons on small screens in addition to swipe gestures.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({ ...settings, showTouchControls: !settings.showTouchControls })
              }
              className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                settings.showTouchControls
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {settings.showTouchControls ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold py-3 text-base transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenZones: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export function PauseModal({
  onResume,
  onRestart,
  onOpenZones,
  onOpenSettings,
  onMainMenu,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-white/15 p-6 shadow-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-white">PAUSED</h2>
        <p className="text-sm text-slate-400 mt-1">Press ESC or Resume to continue your run.</p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold py-3.5 text-base cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/12 text-white font-semibold py-3 text-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTART</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenZones}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/12 text-white font-semibold py-3 text-sm cursor-pointer"
            >
              <Compass className="w-4 h-4 text-sky-400" />
              <span>ZONALAR</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/12 text-white font-semibold py-3 text-sm cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              <span>SETTINGS</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full rounded-xl bg-transparent hover:bg-slate-900 border border-white/10 text-slate-300 font-medium py-2.5 text-sm cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  hud: HudSnapshot;
  onRestart: () => void;
  onOpenZones: () => void;
  onMainMenu: () => void;
}

export function GameOverModal({
  hud,
  onRestart,
  onOpenZones,
  onMainMenu,
}: GameOverModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/78 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-white/15 p-6 sm:p-7 shadow-2xl text-center">
        {hud.caughtByDragon && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-red-400 mb-2">
            <Flame className="w-4 h-4" />
            <span>CAUGHT BY THE PURSUING DRAGON</span>
          </div>
        )}

        <h2 className="font-display text-4xl font-bold text-white tracking-tight">GAME OVER</h2>
        <p className="text-sm text-slate-300 mt-1.5">{hud.gameOverReason || 'Your run has ended.'}</p>

        <div className="grid grid-cols-3 gap-3 mt-6 rounded-xl bg-slate-900 border border-white/10 p-4">
          <div>
            <div className="text-xs text-slate-400">Final Score</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Coins</span>
            </div>
            <div className="font-mono-num text-xl font-bold text-amber-300 mt-0.5">{hud.coins}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Distance</div>
            <div className="font-mono-num text-xl font-bold text-slate-100 mt-0.5">
              {hud.distance}m
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Best Score:</span>
          <span className="font-mono-num font-bold text-amber-300">
            {hud.highScore.toLocaleString()}
          </span>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="mt-6 w-full flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xl font-bold py-4 px-6 transition-colors cursor-pointer shadow-lg"
        >
          <RotateCcw className="w-5 h-5" />
          <span>RESTART</span>
        </button>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            onClick={onOpenZones}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/12 text-white font-semibold py-3 text-sm cursor-pointer"
          >
            <Compass className="w-4 h-4 text-sky-400" />
            <span>ZONALAR</span>
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/12 text-slate-200 font-semibold py-3 text-sm cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
