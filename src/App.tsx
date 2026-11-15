import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import {
  GameOverModal,
  MainMenu,
  PauseModal,
  SettingsModal,
  ZoneModal,
} from './components/Menus';
import { RunnerEngine } from './game/RunnerEngine';
import type { GameSettings, HudSnapshot, PowerUpToast, ZoneId } from './game/types';

const DEFAULT_SETTINGS: GameSettings = {
  dragonEnabled: true,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.42,
  sfxVolume: 0.72,
  showTouchControls: true,
};

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  zone: 'forest',
  score: 0,
  coins: 0,
  fruitsCollected: 0,
  distance: 0,
  highScore: 0,
  speedMultiplier: 1,
  dragonDistance: 4.6,
  activePowerUps: [],
  gameOverReason: '',
  caughtByDragon: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RunnerEngine | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const raw = localStorage.getItem('knight_dragon_settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [toast, setToast] = useState<PowerUpToast | null>(null);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Mount Three.js engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RunnerEngine(mount, 'forest', settings, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onPowerUpToast: (nextToast) => {
        setToast(nextToast);
        if (toastTimeoutRef.current !== null) {
          clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = window.setTimeout(() => {
          setToast(null);
        }, 1950);
      },
    });
    engineRef.current = engine;

    return () => {
      if (toastTimeoutRef.current !== null) {
        clearTimeout(toastTimeoutRef.current);
      }
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync settings to engine & persist
  const handleSettingsChange = useCallback((next: GameSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
    try {
      localStorage.setItem('knight_dragon_settings', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  // Keyboard controls (PC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        if (zonesOpen) {
          setZonesOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (hud.phase === 'playing') engine.pauseRun();
        else if (hud.phase === 'paused') engine.resumeRun();
        return;
      }

      if (hud.phase !== 'playing') return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          engine.moveLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          engine.moveRight();
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          engine.jump();
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          engine.slide();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.phase, zonesOpen, settingsOpen]);

  // Mobile Swipe Gesture Handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || e.changedTouches.length === 0) return;

    const end = e.changedTouches[0];
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < 26) return;

    const engine = engineRef.current;
    if (!engine) return;

    if (absX > absY) {
      if (dx < 0) engine.moveLeft();
      else engine.moveRight();
    } else {
      if (dy < 0) engine.jump();
      else engine.slide();
    }
  }, []);

  const handlePlay = useCallback(() => {
    setZonesOpen(false);
    setSettingsOpen(false);
    engineRef.current?.startRun();
  }, []);

  const handleRestart = useCallback(() => {
    setZonesOpen(false);
    setSettingsOpen(false);
    engineRef.current?.restartRun();
  }, []);

  const handleSelectZone = useCallback((zone: ZoneId) => {
    engineRef.current?.setZone(zone);
  }, []);

  const handleToggleDragon = useCallback(() => {
    handleSettingsChange({ ...settings, dragonEnabled: !settings.dragonEnabled });
  }, [settings, handleSettingsChange]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dedicated WebGL Mount Container (never unmounted on React UI updates) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Main Menu */}
      {hud.phase === 'menu' && (
        <MainMenu
          hud={hud}
          settings={settings}
          onPlay={handlePlay}
          onOpenZones={() => setZonesOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleDragon={handleToggleDragon}
        />
      )}

      {/* Active Run HUD */}
      {(hud.phase === 'playing' || hud.phase === 'catching') && (
        <GameHUD
          hud={hud}
          toast={toast}
          dragonEnabled={settings.dragonEnabled}
          showTouchControls={settings.showTouchControls}
          onPause={() => engineRef.current?.pauseRun()}
          onRestart={handleRestart}
          onMoveLeft={() => engineRef.current?.moveLeft()}
          onMoveRight={() => engineRef.current?.moveRight()}
          onJump={() => engineRef.current?.jump()}
          onSlide={() => engineRef.current?.slide()}
        />
      )}

      {/* Pause Overlay */}
      {hud.phase === 'paused' && (
        <PauseModal
          onResume={() => engineRef.current?.resumeRun()}
          onRestart={handleRestart}
          onOpenZones={() => setZonesOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onMainMenu={() => engineRef.current?.goToMenu()}
        />
      )}

      {/* Game Over Overlay */}
      {hud.phase === 'gameover' && (
        <GameOverModal
          hud={hud}
          onRestart={handleRestart}
          onOpenZones={() => setZonesOpen(true)}
          onMainMenu={() => engineRef.current?.goToMenu()}
        />
      )}

      {/* ZONALAR Modal */}
      {zonesOpen && (
        <ZoneModal
          selectedZone={hud.zone}
          onSelectZone={handleSelectZone}
          onClose={() => setZonesOpen(false)}
        />
      )}

      {/* SETTINGS Modal */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
