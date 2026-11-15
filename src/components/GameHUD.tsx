import {
  Coins,
  Flame,
  Magnet,
  Pause,
  RotateCcw,
  Shield,
  Snowflake,
  Zap,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { HudSnapshot, PowerUpToast, PowerUpType } from '../game/types';
import { ZONES } from '../game/zones';

interface GameHUDProps {
  hud: HudSnapshot;
  toast: PowerUpToast | null;
  dragonEnabled: boolean;
  showTouchControls: boolean;
  onPause: () => void;
  onRestart: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onJump: () => void;
  onSlide: () => void;
}

function PowerUpIcon({ type }: { type: PowerUpType }) {
  switch (type) {
    case 'fire':
      return <Flame className="w-4 h-4 text-orange-400 shrink-0" />;
    case 'ice':
      return <Snowflake className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'lightning':
      return <Zap className="w-4 h-4 text-yellow-300 shrink-0" />;
    case 'golden':
      return <Magnet className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'shield':
      return <Shield className="w-4 h-4 text-purple-400 shrink-0" />;
  }
}

export function GameHUD({
  hud,
  toast,
  dragonEnabled,
  showTouchControls,
  onPause,
  onRestart,
  onMoveLeft,
  onMoveRight,
  onJump,
  onSlide,
}: GameHUDProps) {
  const zoneCfg = ZONES[hud.zone];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Bar: Metrics Left + Controls Right */}
      <div className="flex items-start justify-between gap-4">
        {/* Left Metric Cluster */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 sm:gap-5 rounded-xl bg-slate-950/88 border border-white/12 px-4 py-2.5 shadow-lg">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Score</div>
            <div className="font-mono-num text-lg sm:text-xl font-bold text-white leading-tight">
              {hud.score.toLocaleString()}
            </div>
          </div>

          <div className="h-7 w-px bg-white/10" aria-hidden="true" />

          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[11px] font-medium text-slate-400">Coins</div>
              <div className="font-mono-num text-lg sm:text-xl font-bold text-amber-300 leading-tight">
                {hud.coins}
              </div>
            </div>
          </div>

          <div className="h-7 w-px bg-white/10" aria-hidden="true" />

          <div>
            <div className="text-[11px] font-medium text-slate-400">Distance</div>
            <div className="font-mono-num text-lg sm:text-xl font-bold text-slate-100 leading-tight">
              {hud.distance} m
            </div>
          </div>

          <div className="hidden md:block h-7 w-px bg-white/10" aria-hidden="true" />

          <div className="hidden md:block">
            <div className="text-[11px] font-medium text-slate-400">Zone</div>
            <div className="text-sm font-semibold text-white leading-tight flex items-center gap-2">
              <span>{zoneCfg.name}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono-num text-xs text-slate-300">{hud.speedMultiplier.toFixed(1)}x</span>
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {dragonEnabled && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-950/88 border border-red-500/30 px-3.5 py-2 text-xs font-medium text-red-200">
              <Flame className="w-4 h-4 text-red-400 shrink-0" />
              <span className="whitespace-nowrap">
                Dragon {hud.dragonDistance > 0 ? `${hud.dragonDistance}m behind` : 'Closing in'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart Run"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/88 border border-white/12 px-3.5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900 hover:border-white/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Restart</span>
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause Game"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/88 border border-white/12 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 hover:border-amber-400/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Pause className="w-4 h-4" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Active Power-Ups Bar & Magical Fruit Toast */}
      <div className="flex flex-col items-center gap-3 my-auto pointer-events-none">
        {toast && (
          <div
            key={toast.id}
            className="animate-powerup-banner rounded-xl bg-slate-950/92 border px-5 py-3 text-center shadow-2xl max-w-sm"
            style={{ borderColor: toast.color }}
          >
            <div className="font-display text-base sm:text-lg font-bold tracking-wide text-white">
              {toast.title}
            </div>
            <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{toast.subtitle}</div>
          </div>
        )}
      </div>

      {/* Bottom Row: Power-up Indicators & Optional Touch Controls */}
      <div className="flex flex-col gap-3">
        {hud.activePowerUps.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {hud.activePowerUps.map((p) => {
              const pct = Math.max(0, Math.min(100, (p.remaining / p.duration) * 100));
              return (
                <div
                  key={p.type}
                  className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-slate-950/90 border border-white/12 px-3 py-2 min-w-[148px]"
                >
                  <PowerUpIcon type={p.type} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
                      <span>{p.label}</span>
                      <span className="font-mono-num text-slate-300">{p.remaining.toFixed(1)}s</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-75"
                        style={{ width: `${pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showTouchControls && (
          <div className="pointer-events-auto flex items-center justify-between gap-4 sm:hidden pb-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onMoveLeft}
                aria-label="Move Left"
                className="w-14 h-14 rounded-xl bg-slate-950/88 border border-white/15 flex items-center justify-center text-white active:scale-95"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={onMoveRight}
                aria-label="Move Right"
                className="w-14 h-14 rounded-xl bg-slate-950/88 border border-white/15 flex items-center justify-center text-white active:scale-95"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSlide}
                aria-label="Slide"
                className="w-14 h-14 rounded-xl bg-slate-950/88 border border-white/15 flex items-center justify-center text-white active:scale-95"
              >
                <ArrowDown className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={onJump}
                aria-label="Jump"
                className="w-14 h-14 rounded-xl bg-amber-500 border border-amber-300 flex items-center justify-center text-slate-950 font-bold active:scale-95"
              >
                <ArrowUp className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
