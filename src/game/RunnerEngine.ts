import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gameAudio } from './audio';
import {
  applyZoneToDragon,
  createCollectibleModel,
  createDragonModel,
  createKnightModel,
  createZoneTreeModel,
  type DragonRig,
  type KnightRig,
} from './models';
import {
  createContactShadowTexture,
  createSkyGradientTexture,
  createStoneTexture,
  createTrackTexture,
  createWoodBarkTexture,
} from './textures';
import type {
  ActivePowerUp,
  CollectibleKind,
  GamePhase,
  GameSettings,
  HudSnapshot,
  ObstacleKind,
  PowerUpToast,
  PowerUpType,
  ZoneConfig,
  ZoneId,
} from './types';
import { POWER_UP_META, ZONES } from './zones';

const LANES = [-2.55, 0, 2.55] as const;
const CHUNK_LEN = 24;
const CHUNK_COUNT = 9;
const BASE_SPEED = 16.5;
const MAX_SPEED = 36;
const GRAVITY = -34;
const JUMP_VELOCITY = 13.6;

// Pre-allocated scratch math helpers (Zero GC in tick loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

interface ObstacleEntity {
  kind: ObstacleKind;
  mesh: THREE.Group;
  lane: number; // 0, 1, 2
  localZ: number; // within chunk [-CHUNK_LEN/2, +CHUNK_LEN/2]
  width: number;
  minY: number;
  maxY: number;
  depth: number;
  movingPhase?: number;
  movingSpeed?: number;
  dragonRig?: DragonRig;
  broken?: boolean;
}

interface CollectibleEntity {
  kind: CollectibleKind;
  mesh: THREE.Group;
  lane: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  collected: boolean;
  spinOffset: number;
}

interface TrackChunk {
  group: THREE.Group;
  zCenter: number;
  hasGap: boolean;
  gapLocalZStart: number;
  gapLocalZEnd: number;
  obstacles: ObstacleEntity[];
  collectibles: CollectibleEntity[];
}

interface ParticleBurstItem {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPowerUpToast: (toast: PowerUpToast) => void;
}

export class RunnerEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private maxAnisotropy = 4;

  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  private knight!: KnightRig;
  private chasingDragon!: DragonRig;

  private contactShadowTex!: THREE.Texture;
  private barkTex!: THREE.Texture;
  private snowBarkTex!: THREE.Texture;
  private stoneTex!: THREE.Texture;
  private trackTextures: Partial<Record<ZoneId, THREE.CanvasTexture>> = {};
  private skyTextures: Partial<Record<ZoneId, THREE.CanvasTexture>> = {};

  private chunks: TrackChunk[] = [];
  private ambientParticles!: THREE.Points;
  private burstItems: ParticleBurstItem[] = [];
  private shockwaveRing!: THREE.Mesh;
  private shockwaveTimer = 0;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Game state
  private phase: GamePhase = 'menu';
  private zoneId: ZoneId = 'forest';
  private settings: GameSettings;

  private score = 0;
  private coins = 0;
  private fruitsCollected = 0;
  private distance = 0;
  private highScore = 0;
  private gameOverReason = '';
  private caughtByDragon = false;

  // Knight kinematics
  private targetLane = 1;
  private knightX = 0;
  private knightY = 0;
  private knightVelY = 0;
  private isGrounded = true;
  private isSliding = false;
  private slideTimer = 0;
  private runAnimTime = 0;
  private invincibleTimer = 0;
  private fallDepth = 0;
  private isFallingIntoGap = false;

  // Dragon pursuit kinematics
  private dragonOffsetZ = 4.6;
  private dragonTargetOffsetZ = 4.6;
  private dragonX = 0;
  private dragonCatchTimer = 0;
  private dragonRoarCooldown = 0;

  // Active power-ups
  private powerUps = new Map<PowerUpType, number>();
  private toastCounter = 0;
  private hudSyncAccum = 0;

  // Camera shake & FOV
  private camShake = 0;
  private camX = 0;
  private camY = 4.9;
  private camZ = 9.6;

  // Shared obstacle/collectible geometries/materials cache
  private burstGeo = new THREE.OctahedronGeometry(0.14, 0);

  constructor(
    container: HTMLElement,
    initialZone: ZoneId,
    initialSettings: GameSettings,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.zoneId = initialZone;
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;

    try {
      const saved = localStorage.getItem('knight_dragon_highscore');
      if (saved) this.highScore = Number(saved) || 0;
    } catch {
      // ignore storage errors
    }

    this.initRendererAndScene();
    this.initLightingAndEnv();
    this.initTextures();
    this.initActors();
    this.initAmbientParticles();
    this.applyZoneTheme(this.zoneId);
    this.buildInitialTrack();
    this.bindWindowEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.emitHudSnapshot();
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.2, 220);
    this.camera.position.set(0, this.camY, this.camZ);
    this.camera.lookAt(0, 1.4, -7);
  }

  private initLightingAndEnv(): void {
    // Procedural studio reflections for knight armor, gold coins, and magical fruits
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0xd2f5d6, 0x2a4528, 0.95);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0c8, 2.0);
    this.keyLight.position.set(16, 26, 12);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 90;
    const d = 22;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    this.rimLight.position.set(-14, 12, -20);
    this.scene.add(this.rimLight);
  }

  private initTextures(): void {
    this.contactShadowTex = createContactShadowTexture();
    this.barkTex = createWoodBarkTexture(this.maxAnisotropy, false);
    this.snowBarkTex = createWoodBarkTexture(this.maxAnisotropy, true);
    this.stoneTex = createStoneTexture(this.maxAnisotropy, '#64748b');

    (['snow', 'forest', 'mountain'] as ZoneId[]).forEach((z) => {
      this.trackTextures[z] = createTrackTexture(z, this.maxAnisotropy);
      const cfg = ZONES[z];
      this.skyTextures[z] = createSkyGradientTexture(cfg.skyTopHex, cfg.skyHorizonHex);
    });
  }

  private initActors(): void {
    this.knight = createKnightModel(this.contactShadowTex);
    this.scene.add(this.knight.root);

    this.chasingDragon = createDragonModel(0.95);
    this.chasingDragon.root.position.set(0, 0, this.dragonOffsetZ);
    this.chasingDragon.root.visible = this.settings.dragonEnabled;
    this.scene.add(this.chasingDragon.root);

    this.shockwaveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.72, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.y = 0.15;
    this.shockwaveRing.visible = false;
    this.scene.add(this.shockwaveRing);
  }

  private initAmbientParticles(): void {
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 14 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110 - 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.22,
      transparent: true,
      opacity: 0.72,
    });
    this.ambientParticles = new THREE.Points(geo, mat);
    this.scene.add(this.ambientParticles);
  }

  private applyZoneTheme(zoneId: ZoneId): void {
    const cfg = ZONES[zoneId];
    this.scene.background = this.skyTextures[zoneId] || new THREE.Color(cfg.skyHorizonHex);
    this.scene.fog = new THREE.FogExp2(cfg.fogHex, cfg.fogDensity);
    this.hemiLight.color.setHex(cfg.hemiSkyHex);
    this.hemiLight.groundColor.setHex(cfg.hemiGroundHex);
    this.keyLight.color.setHex(cfg.sunHex);
    this.keyLight.intensity = cfg.sunIntensity;

    const pMat = this.ambientParticles.material as THREE.PointsMaterial;
    pMat.color.setHex(cfg.ambientParticleColor);
    pMat.size = zoneId === 'snow' ? 0.28 : 0.2;

    applyZoneToDragon(this.chasingDragon, cfg);
  }

  private clearTrack(): void {
    for (const chunk of this.chunks) {
      this.scene.remove(chunk.group);
      for (const col of chunk.collectibles) {
        this.scene.remove(col.mesh);
      }
    }
    this.chunks = [];
  }

  private buildInitialTrack(): void {
    this.clearTrack();
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const zCenter = 12 - i * CHUNK_LEN;
      const safeChunk = i < 2;
      const chunk = this.createChunk(zCenter, safeChunk);
      this.chunks.push(chunk);
      this.scene.add(chunk.group);
    }
  }

  private createChunk(zCenter: number, safeOnly: boolean): TrackChunk {
    const cfg: ZoneConfig = ZONES[this.zoneId];
    const group = new THREE.Group();
    group.position.set(0, 0, zCenter);

    // Decide if this chunk has a cliff/broken bridge gap
    const hasGap = !safeOnly && Math.random() < 0.22;
    const gapLocalZStart = -2.6;
    const gapLocalZEnd = 2.6;

    const trackMat = new THREE.MeshStandardMaterial({
      map: this.trackTextures[this.zoneId],
      roughness: this.zoneId === 'snow' ? 0.35 : 0.78,
      metalness: this.zoneId === 'snow' ? 0.08 : 0.04,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: cfg.trackEdgeHex,
      roughness: 0.75,
      metalness: 0.1,
    });

    if (!hasGap) {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.8, CHUNK_LEN), trackMat);
      deck.position.y = -0.4;
      deck.receiveShadow = true;
      group.add(deck);
    } else {
      // Split track deck around the dangerous cliff/bridge gap
      const frontLen = CHUNK_LEN / 2 - Math.abs(gapLocalZStart);
      const backLen = CHUNK_LEN / 2 - Math.abs(gapLocalZEnd);

      const frontDeck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.8, frontLen), trackMat);
      frontDeck.position.set(0, -0.4, gapLocalZStart - frontLen / 2);
      frontDeck.receiveShadow = true;
      group.add(frontDeck);

      const backDeck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.8, backLen), trackMat);
      backDeck.position.set(0, -0.4, gapLocalZEnd + backLen / 2);
      backDeck.receiveShadow = true;
      group.add(backDeck);

      // Broken bridge planks jutting over the gap
      const plankMat = new THREE.MeshStandardMaterial({
        map: this.barkTex,
        roughness: 0.85,
      });
      for (const lx of [-2.55, 0, 2.55]) {
        const stub1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.9), plankMat);
        stub1.position.set(lx, -0.05, gapLocalZEnd - 0.2);
        stub1.rotation.x = 0.22;
        group.add(stub1);

        const stub2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.9), plankMat);
        stub2.position.set(lx, -0.05, gapLocalZStart + 0.2);
        stub2.rotation.x = -0.22;
        group.add(stub2);
      }

      // Deep chasm / river glow below the gap
      const abyss = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 7.5),
        new THREE.MeshBasicMaterial({ color: cfg.waterOrAbyssHex }),
      );
      abyss.rotation.x = -Math.PI / 2;
      abyss.position.set(0, -5.5, 0);
      group.add(abyss);
    }

    // Side Curbs
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, CHUNK_LEN), edgeMat);
      curb.position.set(side * 4.35, 0.12, 0);
      curb.receiveShadow = true;
      curb.castShadow = true;
      group.add(curb);
    }

    // Flanking Zone Terrain (left & right natural environment — never boxed walls!)
    const terrainMat = new THREE.MeshStandardMaterial({
      color: cfg.terrainHex,
      roughness: 0.9,
      metalness: 0.02,
    });
    for (const side of [-1, 1]) {
      if (this.zoneId === 'forest' && side === 1) {
        // Shimmering Forest River alongside right edge
        const river = new THREE.Mesh(
          new THREE.PlaneGeometry(8, CHUNK_LEN),
          new THREE.MeshStandardMaterial({
            color: cfg.waterOrAbyssHex,
            roughness: 0.18,
            metalness: 0.35,
          }),
        );
        river.rotation.x = -Math.PI / 2;
        river.position.set(9.2, -0.85, 0);
        group.add(river);

        const farBank = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, CHUNK_LEN), terrainMat);
        farBank.position.set(24, -1.2, 0);
        group.add(farBank);
      } else if (this.zoneId === 'mountain') {
        // Dramatic canyon cliffs
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(24, 3.2, CHUNK_LEN), terrainMat);
        ledge.position.set(side * 18.5, -3.4, 0);
        group.add(ledge);
      } else {
        const bank = new THREE.Mesh(new THREE.BoxGeometry(24, 1.4, CHUNK_LEN), terrainMat);
        bank.position.set(side * 16.8, -0.8, 0);
        bank.receiveShadow = true;
        group.add(bank);
      }
    }

    // Side Scenery: Zone Trees, Rocks, Ice Crystals, Mountain Spires
    const bark = this.zoneId === 'snow' ? this.snowBarkTex : this.barkTex;
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const xOffset =
        this.zoneId === 'forest' && side === 1
          ? 14.5 + Math.random() * 5
          : side * (6.6 + Math.random() * 6.5);
      const zOffset = -CHUNK_LEN / 2 + 3 + i * 5.2;

      if (this.zoneId === 'mountain' && Math.random() < 0.55) {
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(1.5 + Math.random() * 1.4, 7 + Math.random() * 6, 5),
          new THREE.MeshStandardMaterial({ map: this.stoneTex, color: 0x925f46, roughness: 0.88 }),
        );
        spire.position.set(side * (8.5 + Math.random() * 6), 1.5, zOffset);
        spire.castShadow = true;
        group.add(spire);
      } else {
        const tree = createZoneTreeModel(cfg, bark);
        const s = 0.85 + Math.random() * 0.55;
        tree.scale.setScalar(s);
        tree.position.set(xOffset, this.zoneId === 'mountain' ? -1.8 : -0.1, zOffset);
        tree.rotation.y = Math.random() * Math.PI * 2;
        group.add(tree);
      }

      if (this.zoneId === 'snow' && Math.random() < 0.5) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.65 + Math.random() * 0.4, 0),
          new THREE.MeshPhysicalMaterial({
            color: 0x7dd3fc,
            emissive: 0x0284c7,
            emissiveIntensity: 0.35,
            roughness: 0.12,
            metalness: 0.15,
            clearcoat: 1,
          }),
        );
        crystal.scale.set(0.7, 2.2, 0.7);
        crystal.position.set(side * (5.6 + Math.random() * 1.6), 0.7, zOffset + 1.5);
        group.add(crystal);
      }
    }

    const obstacles: ObstacleEntity[] = [];
    const collectibles: CollectibleEntity[] = [];

    if (!safeOnly) {
      this.populateChunkObstaclesAndItems(
        group,
        zCenter,
        hasGap,
        gapLocalZStart,
        gapLocalZEnd,
        obstacles,
        collectibles,
      );
    } else {
      // Friendly coin trail on initial safe chunks
      for (let k = -1; k <= 1; k++) {
        this.spawnCollectible('coin', 1, 0.9, zCenter + k * 3.5, collectibles);
      }
    }

    return {
      group,
      zCenter,
      hasGap,
      gapLocalZStart,
      gapLocalZEnd,
      obstacles,
      collectibles,
    };
  }

  private populateChunkObstaclesAndItems(
    group: THREE.Group,
    zCenter: number,
    hasGap: boolean,
    gapLocalZStart: number,
    gapLocalZEnd: number,
    obstacles: ObstacleEntity[],
    collectibles: CollectibleEntity[],
  ): void {
    const cfg = ZONES[this.zoneId];

    if (hasGap) {
      // Spawn an exciting parabolic jump arc of coins or a fruit right over the gap!
      const arcLane = Math.floor(Math.random() * 3);
      for (let i = -2; i <= 2; i++) {
        const localZ = i * 1.3;
        const t = i / 2;
        const arcY = 1.0 + (1 - t * t) * 2.1;
        const kind: CollectibleKind = i === 0 && Math.random() < 0.4 ? 'apple' : 'coin';
        this.spawnCollectible(kind, arcLane, arcY, zCenter + localZ, collectibles);
      }
      // Also put a second obstacle well before or after the gap? Keep gaps clean so jump timing feels crisp!
      return;
    }

    // Pick 1 or 2 obstacle rows inside this 24m chunk (at localZ = -5.5 and/or +5.5)
    const rows = Math.random() < 0.65 ? [-5.5, 5.5] : [0];
    for (const rowZ of rows) {
      const blockedLanes = new Set<number>();
      const roll = Math.random();

      if (roll < 0.2) {
        // Fallen Log across 1 or 2 lanes (jumpable!)
        const lane = Math.floor(Math.random() * 3);
        const span2 = Math.random() < 0.45 && lane !== 1 ? 2 : 1;
        const obs = this.createFallenLog(lane, span2, rowZ, cfg);
        group.add(obs.mesh);
        obstacles.push(obs);
        blockedLanes.add(lane);
      } else if (roll < 0.38) {
        // Large Rock or Ice Monolith (dodge left/right)
        const lane1 = Math.floor(Math.random() * 3);
        const obs1 = this.createLargeRock(lane1, rowZ, cfg);
        group.add(obs1.mesh);
        obstacles.push(obs1);
        blockedLanes.add(lane1);

        if (Math.random() < 0.45) {
          const lane2 = (lane1 + 1 + Math.floor(Math.random() * 2)) % 3;
          const obs2 = this.createLargeRock(lane2, rowZ, cfg);
          group.add(obs2.mesh);
          obstacles.push(obs2);
          blockedLanes.add(lane2);
        }
      } else if (roll < 0.54) {
        // Overhead Broken Bridge / Archway (SLIDE underneath!)
        const lane = Math.floor(Math.random() * 3);
        const obs = this.createOverheadArch(lane, rowZ, cfg);
        group.add(obs.mesh);
        obstacles.push(obs);
        blockedLanes.add(lane);
      } else if (roll < 0.7) {
        // Giant Dragon obstacle perched on track
        const lane = Math.floor(Math.random() * 3);
        const obs = this.createTrackDragonObstacle(lane, rowZ, cfg);
        group.add(obs.mesh);
        obstacles.push(obs);
        blockedLanes.add(lane);
      } else if (roll < 0.85) {
        // Moving Rolling/Patrolling Obstacle across lanes
        const obs = this.createMovingObstacle(rowZ, cfg);
        group.add(obs.mesh);
        obstacles.push(obs);
      } else {
        // Large Tree blocking a lane + coin line on open lane
        const lane = Math.floor(Math.random() * 3);
        const obs = this.createLargeTreeObstacle(lane, rowZ, cfg);
        group.add(obs.mesh);
        obstacles.push(obs);
        blockedLanes.add(lane);
      }

      // Place coins / apples / bananas / magical fruits in an open lane
      const freeLanes = [0, 1, 2].filter((l) => !blockedLanes.has(l));
      const itemLane = freeLanes.length > 0 ? freeLanes[Math.floor(Math.random() * freeLanes.length)] : 1;

      const itemRoll = Math.random();
      if (itemRoll < 0.24) {
        // Magical Fruit!
        const magicPool: CollectibleKind[] = [
          'fruit_fire',
          'fruit_ice',
          'fruit_lightning',
          'fruit_golden',
          'fruit_shield',
        ];
        const chosen = magicPool[Math.floor(Math.random() * magicPool.length)];
        this.spawnCollectible(chosen, itemLane, 1.15, zCenter + rowZ, collectibles);
      } else if (itemRoll < 0.34) {
        // Royal Crown Bonus!
        this.spawnCollectible('crown', itemLane, 1.25, zCenter + rowZ, collectibles);
      } else if (itemRoll < 0.56) {
        // Apples & Bananas!
        const fruit: CollectibleKind = Math.random() < 0.5 ? 'apple' : 'banana';
        for (let k = -1; k <= 1; k++) {
          this.spawnCollectible(
            k === 0 ? fruit : 'coin',
            itemLane,
            0.95,
            zCenter + rowZ + k * 2.1,
            collectibles,
          );
        }
      } else {
        // Row of Golden Coins
        for (let k = -1; k <= 1; k++) {
          this.spawnCollectible('coin', itemLane, 0.9, zCenter + rowZ + k * 2.0, collectibles);
        }
      }
    }
  }

  private createFallenLog(
    lane: number,
    span: number,
    localZ: number,
    cfg: ZoneConfig,
  ): ObstacleEntity {
    const g = new THREE.Group();
    const width = span === 2 ? 4.4 : 2.15;
    const xCenter =
      span === 2 ? (lane === 0 ? (LANES[0] + LANES[1]) / 2 : (LANES[1] + LANES[2]) / 2) : LANES[lane];
    g.position.set(xCenter, 0, localZ);

    const barkMat = new THREE.MeshStandardMaterial({
      map: this.zoneId === 'snow' ? this.snowBarkTex : this.barkTex,
      roughness: 0.88,
    });
    const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, width, 10), barkMat);
    logMesh.rotation.z = Math.PI / 2;
    logMesh.position.y = 0.48;
    logMesh.castShadow = true;
    g.add(logMesh);

    // End rings & moss/snow detail
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10),
        new THREE.MeshStandardMaterial({ color: 0xd6b07c, roughness: 0.75 }),
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(s * (width / 2), 0.48, 0);
      g.add(cap);
    }

    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.7, 0.16, 0.5),
      new THREE.MeshStandardMaterial({
        color: this.zoneId === 'snow' ? 0xf8fafc : cfg.accentPropHex,
        roughness: 0.7,
      }),
    );
    accent.position.y = 0.94;
    g.add(accent);

    return {
      kind: 'fallen_log',
      mesh: g,
      lane,
      localZ,
      width: width * 0.88,
      minY: 0,
      maxY: 1.02,
      depth: 1.0,
    };
  }

  private createLargeRock(lane: number, localZ: number, cfg: ZoneConfig): ObstacleEntity {
    const g = new THREE.Group();
    g.position.set(LANES[lane], 0, localZ);

    const rockMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: this.zoneId === 'snow' ? 0xbae6fd : this.zoneId === 'forest' ? 0x64748b : 0x7c4a36,
      roughness: this.zoneId === 'snow' ? 0.25 : 0.85,
      metalness: this.zoneId === 'snow' ? 0.15 : 0.05,
    });
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), rockMat);
    main.position.y = 0.85;
    main.scale.set(1.0, 1.15, 0.95);
    main.castShadow = true;
    g.add(main);

    const sideRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), rockMat);
    sideRock.position.set(0.55, 0.42, 0.35);
    sideRock.castShadow = true;
    g.add(sideRock);

    if (this.zoneId !== 'mountain') {
      const topPatch = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.52, 0),
        new THREE.MeshStandardMaterial({
          color: this.zoneId === 'snow' ? 0xf8fafc : cfg.terrainHex,
          roughness: 0.7,
        }),
      );
      topPatch.position.set(-0.15, 1.65, 0);
      topPatch.scale.set(1.2, 0.45, 1.1);
      g.add(topPatch);
    }

    return {
      kind: 'large_rock',
      mesh: g,
      lane,
      localZ,
      width: 1.85,
      minY: 0,
      maxY: 1.9,
      depth: 1.7,
    };
  }

  private createOverheadArch(lane: number, localZ: number, cfg: ZoneConfig): ObstacleEntity {
    const g = new THREE.Group();
    g.position.set(LANES[lane], 0, localZ);

    const pillarMat = new THREE.MeshStandardMaterial({
      map: this.stoneTex,
      color: cfg.trackEdgeHex,
      roughness: 0.8,
    });
    const beamMat = new THREE.MeshStandardMaterial({
      map: this.barkTex,
      color: 0xb45309,
      roughness: 0.72,
    });

    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.7, 0.34), pillarMat);
      post.position.set(s * 0.95, 1.35, 0);
      post.castShadow = true;
      g.add(post);
    }

    // Low crossbar at y=1.35 -> Knight MUST slide under (slide height = 0.85)!
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.95, 0.65), beamMat);
    beam.position.set(0, 1.85, 0);
    beam.castShadow = true;
    g.add(beam);

    // Warning spiked banner on crossbar
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.25, 0.72),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.4,
      }),
    );
    banner.position.set(0, 1.5, 0);
    g.add(banner);

    return {
      kind: 'overhead_arch',
      mesh: g,
      lane,
      localZ,
      width: 2.05,
      minY: 1.28,
      maxY: 2.8,
      depth: 0.85,
    };
  }

  private createLargeTreeObstacle(lane: number, localZ: number, cfg: ZoneConfig): ObstacleEntity {
    const g = new THREE.Group();
    g.position.set(LANES[lane], 0, localZ);
    const tree = createZoneTreeModel(cfg, this.zoneId === 'snow' ? this.snowBarkTex : this.barkTex);
    tree.scale.setScalar(0.85);
    g.add(tree);

    return {
      kind: 'large_tree',
      mesh: g,
      lane,
      localZ,
      width: 1.55,
      minY: 0,
      maxY: 3.8,
      depth: 1.4,
    };
  }

  private createMovingObstacle(localZ: number, cfg: ZoneConfig): ObstacleEntity {
    const g = new THREE.Group();
    const phase = Math.random() * Math.PI * 2;
    g.position.set(0, 0, localZ);

    const sphere = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.82, 1),
      new THREE.MeshStandardMaterial({
        map: this.stoneTex,
        color: this.zoneId === 'snow' ? 0x38bdf8 : cfg.trackEdgeHex,
        roughness: 0.45,
        metalness: 0.35,
      }),
    );
    sphere.position.y = 0.82;
    sphere.castShadow = true;
    g.add(sphere);

    // Iron spikes around rolling hazard
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.22,
    });
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 5), spikeMat);
      spike.position.set(Math.cos(a) * 0.84, 0.82, Math.sin(a) * 0.84);
      spike.rotation.z = -Math.PI / 2;
      spike.rotation.y = -a;
      g.add(spike);
    }

    return {
      kind: 'moving_hazard',
      mesh: g,
      lane: 1,
      localZ,
      width: 1.65,
      minY: 0,
      maxY: 1.65,
      depth: 1.5,
      movingPhase: phase,
      movingSpeed: 1.85,
    };
  }

  private createTrackDragonObstacle(lane: number, localZ: number, cfg: ZoneConfig): ObstacleEntity {
    const rig = createDragonModel(0.75);
    applyZoneToDragon(rig, cfg);
    rig.root.position.set(LANES[lane], 0, localZ);
    // Face +Z toward oncoming knight
    rig.root.rotation.y = Math.PI;
    rig.breathCone.visible = true;

    return {
      kind: 'giant_dragon',
      mesh: rig.root,
      lane,
      localZ,
      width: 1.9,
      minY: 0,
      maxY: 2.3,
      depth: 2.1,
      dragonRig: rig,
    };
  }

  private spawnCollectible(
    kind: CollectibleKind,
    lane: number,
    worldY: number,
    worldZ: number,
    list: CollectibleEntity[],
  ): void {
    const mesh = createCollectibleModel(kind);
    const worldX = LANES[lane];
    mesh.position.set(worldX, worldY, worldZ);
    this.scene.add(mesh);

    list.push({
      kind,
      mesh,
      lane,
      worldX,
      worldY,
      worldZ,
      collected: false,
      spinOffset: Math.random() * Math.PI * 2,
    });
  }

  private spawnBurstParticles(x: number, y: number, z: number, colorHex: number, count = 18): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(this.burstGeo, mat);
      mesh.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 6.5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * spd,
        2.5 + Math.random() * 5.5,
        Math.sin(angle) * spd,
      );
      this.scene.add(mesh);
      this.burstItems.push({ mesh, vel, life: 0.65, maxLife: 0.65 });
    }

    const rMat = this.shockwaveRing.material as THREE.MeshBasicMaterial;
    rMat.color.setHex(colorHex);
    rMat.opacity = 0.9;
    this.shockwaveRing.position.set(x, Math.max(0.18, y * 0.4), z);
    this.shockwaveRing.scale.setScalar(1);
    this.shockwaveRing.visible = true;
    this.shockwaveTimer = 0.45;
  }

  // Public API for React UI
  public startRun(): void {
    gameAudio.unlock();
    this.resetRunState();
    this.phase = 'playing';
    gameAudio.restartMusicForZone(this.zoneId);
    this.emitHudSnapshot();
  }

  public restartRun(): void {
    this.startRun();
  }

  public pauseRun(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      gameAudio.stopMusic();
      this.emitHudSnapshot();
    }
  }

  public resumeRun(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.clock.getDelta();
      gameAudio.startMusic(this.zoneId);
      this.emitHudSnapshot();
    }
  }

  public goToMenu(): void {
    this.phase = 'menu';
    gameAudio.stopMusic();
    this.resetRunState();
    this.emitHudSnapshot();
  }

  public setZone(zoneId: ZoneId): void {
    if (this.zoneId === zoneId) return;
    this.zoneId = zoneId;
    this.applyZoneTheme(zoneId);
    this.buildInitialTrack();
    gameAudio.setZone(zoneId);
    if (this.phase === 'playing') {
      gameAudio.restartMusicForZone(zoneId);
    }
    this.emitHudSnapshot();
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    this.chasingDragon.root.visible = this.settings.dragonEnabled;
    gameAudio.configure({
      musicEnabled: this.settings.musicEnabled,
      sfxEnabled: this.settings.sfxEnabled,
      musicVolume: this.settings.musicVolume,
      sfxVolume: this.settings.sfxVolume,
    });
    this.emitHudSnapshot();
  }

  public moveLeft(): void {
    if (this.phase !== 'playing') return;
    if (this.targetLane > 0) {
      this.targetLane -= 1;
      gameAudio.playLane();
    }
  }

  public moveRight(): void {
    if (this.phase !== 'playing') return;
    if (this.targetLane < 2) {
      this.targetLane += 1;
      gameAudio.playLane();
    }
  }

  public jump(): void {
    if (this.phase !== 'playing') return;
    if (this.isGrounded && !this.isFallingIntoGap) {
      this.knightVelY = JUMP_VELOCITY;
      this.isGrounded = false;
      this.isSliding = false;
      this.slideTimer = 0;
      gameAudio.playJump();
    }
  }

  public slide(): void {
    if (this.phase !== 'playing') return;
    if (!this.isGrounded && !this.isFallingIntoGap) {
      // Fast-fall slam into slide!
      this.knightVelY = Math.min(this.knightVelY, -22);
    }
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = 0.72;
      gameAudio.playSlide();
    }
  }

  private resetRunState(): void {
    this.score = 0;
    this.coins = 0;
    this.fruitsCollected = 0;
    this.distance = 0;
    this.gameOverReason = '';
    this.caughtByDragon = false;

    this.targetLane = 1;
    this.knightX = 0;
    this.knightY = 0;
    this.knightVelY = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.invincibleTimer = 0;
    this.isFallingIntoGap = false;
    this.fallDepth = 0;

    this.dragonOffsetZ = 4.6;
    this.dragonTargetOffsetZ = 4.6;
    this.dragonX = 0;
    this.dragonCatchTimer = 0;

    this.powerUps.clear();
    this.knight.root.position.set(0, 0, 0);
    this.knight.root.rotation.set(0, 0, 0);
    this.knight.bodyPivot.rotation.set(0, 0, 0);
    this.knight.bodyPivot.scale.set(1, 1, 1);

    this.chasingDragon.root.visible = this.settings.dragonEnabled;
    this.chasingDragon.root.position.set(0, 0, this.dragonOffsetZ);
    this.chasingDragon.breathCone.visible = false;

    this.camX = 0;
    this.camY = 4.9;
    this.camZ = 9.6;
    this.camShake = 0;

    this.buildInitialTrack();
  }

  private bindWindowEvents(): void {
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private startLoop(): void {
    this.clock.start();
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        this.frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private getCurrentSpeed(): number {
    const base = Math.min(MAX_SPEED, BASE_SPEED + this.distance * 0.0135);
    let mul = 1;
    if (this.powerUps.has('ice')) mul *= 0.64;
    if (this.powerUps.has('lightning')) mul *= 1.42;
    return base * mul;
  }

  private update(dt: number): void {
    if (this.phase === 'menu') {
      this.runAnimTime += dt;
      this.animateKnightIdleOrMenu(dt);
      this.animateChasingDragon(dt, 14);
      this.updateAmbientParticles(dt, 4);
      this.camera.position.set(
        2.6 + Math.sin(this.runAnimTime * 0.45) * 0.9,
        3.65,
        7.6,
      );
      this.camera.lookAt(0, 1.5, 0.8);
      return;
    }

    if (this.phase === 'paused') {
      return;
    }

    if (this.phase === 'catching') {
      this.updateDragonCatchSequence(dt);
      this.updateBurstParticles(dt);
      return;
    }

    if (this.phase === 'gameover') {
      this.runAnimTime += dt;
      this.updateBurstParticles(dt);
      if (this.settings.dragonEnabled && this.caughtByDragon) {
        this.animateChasingDragon(dt, 0);
      }
      return;
    }

    // PLAYING PHASE
    const speed = this.getCurrentSpeed();
    const moveZ = speed * dt;
    this.distance += moveZ;
    this.score += moveZ * 2.2;
    this.runAnimTime += dt;

    if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    if (this.dragonRoarCooldown > 0) this.dragonRoarCooldown -= dt;

    // Tick power-ups
    for (const [key, rem] of this.powerUps.entries()) {
      if (key === 'shield') continue; // shield lasts until consumed or timer expires
      const next = rem - dt;
      if (next <= 0) this.powerUps.delete(key);
      else this.powerUps.set(key, next);
    }
    if (this.powerUps.has('shield')) {
      const rem = (this.powerUps.get('shield') ?? 0) - dt;
      if (rem <= 0) this.powerUps.delete('shield');
      else this.powerUps.set('shield', rem);
    }

    // Update Knight Lane & Jump Physics
    const targetX = LANES[this.targetLane];
    const prevX = this.knightX;
    this.knightX = THREE.MathUtils.damp(this.knightX, targetX, 15, dt);
    const lateralVel = (this.knightX - prevX) / Math.max(dt, 0.001);

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    if (!this.isGrounded || this.isFallingIntoGap) {
      this.knightVelY += GRAVITY * dt;
      this.knightY += this.knightVelY * dt;
      if (!this.isFallingIntoGap && this.knightY <= 0) {
        this.knightY = 0;
        this.knightVelY = 0;
        this.isGrounded = true;
      }
    }

    // Check if knight stepped over an active gap while grounded
    if (!this.isFallingIntoGap && this.knightY <= 0.15) {
      for (const chunk of this.chunks) {
        if (chunk.hasGap) {
          const gapZMin = chunk.zCenter + chunk.gapLocalZStart + 0.35;
          const gapZMax = chunk.zCenter + chunk.gapLocalZEnd - 0.35;
          if (0 >= gapZMin && 0 <= gapZMax) {
            this.isFallingIntoGap = true;
            this.isGrounded = false;
            this.fallDepth = 0;
            break;
          }
        }
      }
    }

    if (this.isFallingIntoGap) {
      this.fallDepth += dt;
      if (this.knightY < -3.2) {
        this.triggerImpact('Fell into a deep chasm!');
        return;
      }
    }

    this.knight.root.position.set(this.knightX, this.knightY, 0);
    // Bank into lane turns
    this.knight.bodyPivot.rotation.z = THREE.MathUtils.clamp(-lateralVel * 0.032, -0.32, 0.32);

    // Keep contact shadow on the road surface and fade with jump height
    this.knight.contactShadow.position.y = Math.max(0.025, 0.025 - this.knightY);
    (this.knight.contactShadow.material as THREE.MeshBasicMaterial).opacity =
      this.isFallingIntoGap ? 0 : THREE.MathUtils.clamp(0.55 - this.knightY * 0.14, 0.1, 0.55);

    this.animateKnightRunJumpSlide(dt, speed);
    this.updateKnightPowerUpVisuals(dt);

    // Advance & recycle chunks
    this.updateTrackChunks(dt, moveZ);

    // Update Dragon Pursuit
    this.dragonTargetOffsetZ = THREE.MathUtils.damp(this.dragonTargetOffsetZ, 4.6, 0.9, dt);
    this.dragonOffsetZ = THREE.MathUtils.damp(this.dragonOffsetZ, this.dragonTargetOffsetZ, 5, dt);
    this.dragonX = THREE.MathUtils.damp(this.dragonX, this.knightX * 0.85, 4.5, dt);
    this.animateChasingDragon(dt, speed);

    // Update Ambient & Burst particles
    this.updateAmbientParticles(dt, moveZ);
    this.updateBurstParticles(dt);

    // Update Chase Camera with smooth FOV surge & shake
    const targetFov = this.powerUps.has('lightning') ? 74 : this.powerUps.has('ice') ? 57 : 63;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();

    this.camX = THREE.MathUtils.damp(this.camX, this.knightX * 0.55, 8, dt);
    this.camY = THREE.MathUtils.damp(this.camY, 4.9 + Math.max(0, this.knightY * 0.48), 8, dt);
    this.camShake = Math.max(0, this.camShake - dt * 2.5);
    const sx = (Math.random() - 0.5) * this.camShake;
    const sy = (Math.random() - 0.5) * this.camShake;

    this.camera.position.set(this.camX + sx, this.camY + sy, this.camZ);
    this.camera.lookAt(this.knightX * 0.45, 1.5 + Math.max(0, this.knightY * 0.4), -8.0);

    // Sync React HUD at ~18Hz so React never causes frame jitter
    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.055) {
      this.hudSyncAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private updateTrackChunks(dt: number, moveZ: number): void {
    const hasMagnet = this.powerUps.has('golden');
    const hasFire = this.powerUps.has('fire');
    const hasLightning = this.powerUps.has('lightning');

    for (const chunk of this.chunks) {
      chunk.zCenter += moveZ;
      chunk.group.position.z = chunk.zCenter;

      // Update obstacles in chunk & check collisions
      for (const obs of chunk.obstacles) {
        if (obs.broken) continue;

        if (obs.kind === 'moving_hazard' && obs.movingPhase !== undefined) {
          obs.movingPhase += dt * (obs.movingSpeed || 1.8);
          const x = Math.sin(obs.movingPhase) * 2.6;
          obs.mesh.position.x = x;
          obs.mesh.children[0].rotation.z -= dt * 4.5;
        } else if (obs.kind === 'giant_dragon' && obs.dragonRig) {
          this.animateObstacleDragon(obs.dragonRig, dt);
        }

        const worldZ = chunk.zCenter + obs.localZ;
        if (Math.abs(worldZ) < obs.depth * 0.55 + 0.42) {
          const obsX = obs.mesh.position.x;
          const knightHalfW = 0.36;
          if (Math.abs(this.knightX - obsX) < obs.width * 0.46 + knightHalfW) {
            const knightMinY = this.knightY;
            const knightMaxY = this.knightY + (this.isSliding ? 0.82 : 1.75);
            if (knightMaxY > obs.minY + 0.08 && knightMinY < obs.maxY - 0.08) {
              // Collision!
              if (hasLightning || (hasFire && (obs.kind === 'giant_dragon' || obs.kind === 'fallen_log' || obs.kind === 'large_rock'))) {
                // Smash through!
                obs.broken = true;
                obs.mesh.visible = false;
                this.score += 120;
                this.camShake = 0.32;
                this.spawnBurstParticles(obsX, 1.0, worldZ, hasLightning ? 0xfacc15 : 0xf97316, 22);
                gameAudio.playShieldBreak();
              } else if (this.invincibleTimer > 0) {
                // grace invincibility
              } else if (this.powerUps.has('shield')) {
                this.powerUps.delete('shield');
                obs.broken = true;
                obs.mesh.visible = false;
                this.invincibleTimer = 1.25;
                this.camShake = 0.38;
                // Dragon surges closer on stumble!
                this.dragonTargetOffsetZ = 2.5;
                if (this.settings.dragonEnabled && this.dragonRoarCooldown <= 0) {
                  gameAudio.playDragonRoar();
                  this.dragonRoarCooldown = 1.5;
                } else {
                  gameAudio.playShieldBreak();
                }
                this.spawnBurstParticles(this.knightX, 1.1, 0, 0xa855f7, 24);
                this.emitHudSnapshot();
              } else {
                const reasonMap: Record<ObstacleKind, string> = {
                  cliff_gap: 'Fell into a deep cliff!',
                  fallen_log: 'Tripped over a fallen giant log!',
                  giant_dragon: 'Struck by a fire dragon!',
                  large_rock: 'Crashed into a massive boulder!',
                  broken_bridge: 'Fell off a broken bridge!',
                  moving_hazard: 'Hit by a rolling spiked hazard!',
                  overhead_arch: 'Hit an overhead barrier! (Slide under with DOWN)',
                  large_tree: 'Collided with an ancient tree!',
                };
                this.triggerImpact(reasonMap[obs.kind]);
                return;
              }
            }
          }
        }
      }

      // Update collectibles
      for (const col of chunk.collectibles) {
        if (col.collected) continue;
        col.worldZ += moveZ;

        // Golden Fruit Magnet Attraction
        if (hasMagnet && col.worldZ > -14 && col.worldZ < 2.2) {
          _v1.set(this.knightX - col.worldX, this.knightY + 0.9 - col.worldY, -col.worldZ);
          const dist = _v1.length();
          if (dist < 13 && dist > 0.01) {
            _v1.normalize().multiplyScalar(28 * dt);
            col.worldX += _v1.x;
            col.worldY += _v1.y;
            col.worldZ += _v1.z;
          }
        }

        col.mesh.position.set(
          col.worldX,
          col.worldY + Math.sin(this.runAnimTime * 4 + col.spinOffset) * 0.12,
          col.worldZ,
        );
        col.mesh.rotation.y += dt * 3.1;

        // Check pickup
        const dx = col.worldX - this.knightX;
        const dy = col.worldY - (this.knightY + (this.isSliding ? 0.55 : 0.95));
        const dz = col.worldZ;
        if (dx * dx + dy * dy + dz * dz < 1.35) {
          this.collectItem(col);
        }
      }
    }

    // Recycle farthest-behind chunk back to horizon
    const frontMostZ = this.chunks.reduce((minZ, c) => Math.min(minZ, c.zCenter), 999);
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (c.zCenter > 30) {
        this.scene.remove(c.group);
        for (const col of c.collectibles) {
          this.scene.remove(col.mesh);
        }
        const newZ = frontMostZ - CHUNK_LEN;
        const replacement = this.createChunk(newZ, false);
        this.chunks[i] = replacement;
        this.scene.add(replacement.group);
      }
    }
  }

  private collectItem(col: CollectibleEntity): void {
    col.collected = true;
    col.mesh.visible = false;

    if (col.kind === 'coin') {
      this.coins += 1;
      this.score += 20;
      gameAudio.playCoin();
    } else if (col.kind === 'apple' || col.kind === 'banana') {
      this.fruitsCollected += 1;
      this.coins += 2;
      this.score += 50;
      gameAudio.playFruit();
      this.spawnBurstParticles(col.worldX, col.worldY, col.worldZ, col.kind === 'apple' ? 0xef4444 : 0xfacc15, 10);
    } else if (col.kind === 'crown') {
      this.coins += 10;
      this.score += 250;
      gameAudio.playBonus();
      this.spawnBurstParticles(col.worldX, col.worldY, col.worldZ, 0xfde047, 20);
    } else if (col.kind.startsWith('fruit_')) {
      const pType = col.kind.replace('fruit_', '') as PowerUpType;
      const meta = POWER_UP_META[pType];
      this.fruitsCollected += 1;
      this.score += 100;
      this.powerUps.set(pType, meta.duration);
      gameAudio.playPowerUp();
      this.spawnBurstParticles(col.worldX, col.worldY, col.worldZ, meta.hex, 26);

      this.callbacks.onPowerUpToast({
        id: ++this.toastCounter,
        type: pType,
        title: meta.title,
        subtitle: meta.subtitle,
        color: meta.color,
      });
      this.emitHudSnapshot();
    }
  }

  private triggerImpact(reason: string): void {
    this.gameOverReason = reason;
    gameAudio.stopMusic();

    if (this.settings.dragonEnabled) {
      // Dramatic Chasing Dragon Catch sequence!
      this.phase = 'catching';
      this.caughtByDragon = true;
      this.dragonCatchTimer = 0.92;
      this.camShake = 0.55;
      this.chasingDragon.breathCone.visible = true;
      gameAudio.playDragonRoar();
      this.emitHudSnapshot();
    } else {
      this.caughtByDragon = false;
      this.finalizeGameOver();
    }
  }

  private updateDragonCatchSequence(dt: number): void {
    this.dragonCatchTimer -= dt;
    this.runAnimTime += dt;

    // Dragon lunges right onto the knight with snapping jaws and roaring wings
    this.dragonOffsetZ = THREE.MathUtils.damp(this.dragonOffsetZ, 1.05, 9, dt);
    this.dragonX = THREE.MathUtils.damp(this.dragonX, this.knightX, 11, dt);
    this.chasingDragon.root.position.set(this.dragonX, Math.max(0, this.knightY * 0.4), this.dragonOffsetZ);
    this.chasingDragon.jawGroup.rotation.x = 0.55 + Math.sin(this.runAnimTime * 22) * 0.15;
    this.chasingDragon.leftWingInner.rotation.z = Math.sin(this.runAnimTime * 16) * 0.55 + 0.25;
    this.chasingDragon.rightWingInner.rotation.z = -Math.sin(this.runAnimTime * 16) * 0.55 - 0.25;

    // Knight recoils / drops
    this.knight.bodyPivot.rotation.x = THREE.MathUtils.damp(this.knight.bodyPivot.rotation.x, 0.7, 8, dt);

    // Dynamic camera shake & close-in
    this.camShake = Math.max(0, this.camShake - dt * 0.4);
    this.camera.position.set(
      this.knightX * 0.5 + (Math.random() - 0.5) * this.camShake,
      3.9 + (Math.random() - 0.5) * this.camShake,
      7.2,
    );
    this.camera.lookAt(this.knightX, 1.3, 0);

    if (this.dragonCatchTimer <= 0) {
      this.finalizeGameOver();
    }
  }

  private finalizeGameOver(): void {
    this.phase = 'gameover';
    const finalScore = Math.floor(this.score);
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      try {
        localStorage.setItem('knight_dragon_highscore', String(this.highScore));
      } catch {
        // ignore
      }
    }
    gameAudio.playGameOver();
    this.emitHudSnapshot();
  }

  private animateKnightIdleOrMenu(dt: number): void {
    const t = this.runAnimTime;
    this.knight.root.position.set(0, 0, 0);
    this.knight.bodyPivot.scale.set(1, 1, 1);
    this.knight.bodyPivot.position.y = Math.abs(Math.sin(t * 7.5)) * 0.12;
    this.knight.leftLeg.rotation.x = Math.sin(t * 7.5) * 0.75;
    this.knight.rightLeg.rotation.x = -Math.sin(t * 7.5) * 0.75;
    this.knight.leftArm.rotation.x = -Math.sin(t * 7.5) * 0.55;
    this.knight.rightArm.rotation.x = Math.sin(t * 7.5) * 0.55;
    this.knight.cape.rotation.x = 0.42 + Math.sin(t * 10) * 0.14;
    this.knight.torso.rotation.x = 0.16;
    void dt;
  }

  private animateKnightRunJumpSlide(dt: number, speed: number): void {
    const freq = speed * 0.55;
    const t = this.runAnimTime * freq;

    if (this.isSliding) {
      this.knight.bodyPivot.scale.y = THREE.MathUtils.damp(this.knight.bodyPivot.scale.y, 0.56, 18, dt);
      this.knight.bodyPivot.rotation.x = THREE.MathUtils.damp(this.knight.bodyPivot.rotation.x, -0.58, 18, dt);
      this.knight.bodyPivot.position.y = THREE.MathUtils.damp(this.knight.bodyPivot.position.y, 0.08, 18, dt);
      this.knight.leftLeg.rotation.x = THREE.MathUtils.damp(this.knight.leftLeg.rotation.x, -1.1, 18, dt);
      this.knight.rightLeg.rotation.x = THREE.MathUtils.damp(this.knight.rightLeg.rotation.x, -0.95, 18, dt);
      this.knight.cape.rotation.x = 0.85;
    } else if (!this.isGrounded) {
      this.knight.bodyPivot.scale.y = THREE.MathUtils.damp(this.knight.bodyPivot.scale.y, 1, 14, dt);
      this.knight.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.knight.bodyPivot.rotation.x,
        this.knightVelY > 0 ? 0.14 : -0.1,
        10,
        dt,
      );
      this.knight.leftLeg.rotation.x = THREE.MathUtils.damp(this.knight.leftLeg.rotation.x, 0.55, 12, dt);
      this.knight.rightLeg.rotation.x = THREE.MathUtils.damp(this.knight.rightLeg.rotation.x, -0.45, 12, dt);
      this.knight.leftArm.rotation.x = THREE.MathUtils.damp(this.knight.leftArm.rotation.x, -0.8, 12, dt);
      this.knight.rightArm.rotation.x = THREE.MathUtils.damp(this.knight.rightArm.rotation.x, -0.6, 12, dt);
      this.knight.cape.rotation.x = 0.72 + Math.sin(this.runAnimTime * 15) * 0.16;
    } else {
      // Energetic 3D Sprint Cycle
      this.knight.bodyPivot.scale.y = THREE.MathUtils.damp(this.knight.bodyPivot.scale.y, 1, 16, dt);
      this.knight.bodyPivot.rotation.x = THREE.MathUtils.damp(this.knight.bodyPivot.rotation.x, 0.18, 14, dt);
      this.knight.bodyPivot.position.y = Math.abs(Math.sin(t)) * 0.16;
      this.knight.torso.rotation.y = Math.sin(t) * 0.1;
      this.knight.leftLeg.rotation.x = Math.sin(t) * 0.92;
      this.knight.rightLeg.rotation.x = -Math.sin(t) * 0.92;
      this.knight.leftArm.rotation.x = -Math.sin(t) * 0.72;
      this.knight.rightArm.rotation.x = Math.sin(t) * 0.72;
      this.knight.cape.rotation.x = 0.45 + Math.sin(this.runAnimTime * 14) * 0.16;
    }
  }

  private updateKnightPowerUpVisuals(dt: number): void {
    const t = this.runAnimTime;
    this.knight.fireAura.visible = this.powerUps.has('fire');
    if (this.knight.fireAura.visible) {
      this.knight.fireAura.rotation.z += dt * 7;
      this.knight.fireAura.scale.setScalar(1 + Math.sin(t * 14) * 0.08);
    }

    this.knight.shieldBubble.visible = this.powerUps.has('shield');
    if (this.knight.shieldBubble.visible) {
      this.knight.shieldBubble.rotation.y += dt * 1.8;
    }

    this.knight.magnetRing.visible = this.powerUps.has('golden');
    if (this.knight.magnetRing.visible) {
      this.knight.magnetRing.rotation.z -= dt * 5;
      this.knight.magnetRing.position.y = 0.35 + Math.sin(t * 8) * 0.18;
    }

    this.knight.lightningRing.visible = this.powerUps.has('lightning');
    if (this.knight.lightningRing.visible) {
      this.knight.lightningRing.rotation.x += dt * 9;
      this.knight.lightningRing.rotation.y += dt * 7;
    }

    this.knight.frostAura.visible = this.powerUps.has('ice');
    if (this.knight.frostAura.visible) {
      this.knight.frostAura.rotation.y -= dt * 2.4;
      this.knight.frostAura.rotation.x += dt * 1.5;
    }
  }

  private animateChasingDragon(dt: number, speed: number): void {
    if (!this.settings.dragonEnabled) {
      this.chasingDragon.root.visible = false;
      return;
    }
    this.chasingDragon.root.visible = true;
    const t = this.runAnimTime;

    const bob = Math.sin(t * 7.2) * 0.32;
    this.chasingDragon.root.position.set(this.dragonX, 0.45 + bob, this.dragonOffsetZ);
    this.chasingDragon.root.rotation.z = THREE.MathUtils.clamp((this.knightX - this.dragonX) * 0.12, -0.25, 0.25);

    // Wing flap
    const flap = Math.sin(t * 8.5);
    this.chasingDragon.leftWingInner.rotation.z = flap * 0.55 + 0.15;
    this.chasingDragon.leftWingOuter.rotation.z = flap * 0.35 - 0.15;
    this.chasingDragon.rightWingInner.rotation.z = -flap * 0.55 - 0.15;
    this.chasingDragon.rightWingOuter.rotation.z = -flap * 0.35 + 0.15;

    // Jaw snap & neck weave
    this.chasingDragon.jawGroup.rotation.x = 0.18 + Math.max(0, Math.sin(t * 4.5)) * 0.25;
    this.chasingDragon.neckGroup.rotation.y = Math.sin(t * 3.1) * 0.14;
    this.chasingDragon.breathCone.visible = Math.sin(t * 3.2) > 0.72;

    // Legs galloping
    this.chasingDragon.leftLeg.rotation.x = Math.sin(t * 9) * 0.55;
    this.chasingDragon.rightLeg.rotation.x = -Math.sin(t * 9) * 0.55;

    // Whip tail wave
    this.chasingDragon.tailSegments.forEach((seg, idx) => {
      seg.rotation.y = Math.sin(t * 6 - idx * 0.7) * 0.22;
    });
    void dt;
    void speed;
  }

  private animateObstacleDragon(rig: DragonRig, dt: number): void {
    const t = this.runAnimTime + dt;
    const flap = Math.sin(t * 7.5);
    rig.leftWingInner.rotation.z = flap * 0.45 + 0.2;
    rig.rightWingInner.rotation.z = -flap * 0.45 - 0.2;
    rig.jawGroup.rotation.x = 0.25 + Math.sin(t * 6) * 0.15;
    rig.bodyGroup.position.y = 1.65 + Math.sin(t * 4) * 0.2;
  }

  private updateAmbientParticles(dt: number, moveZ: number): void {
    const pos = this.ambientParticles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const fallRate = this.zoneId === 'snow' ? 3.2 : 0.85;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= fallRate * dt;
      arr[i + 2] += moveZ * 0.9;
      if (arr[i + 1] < 0) arr[i + 1] = 13 + Math.random() * 3;
      if (arr[i + 2] > 18) arr[i + 2] = -88 - Math.random() * 15;
    }
    pos.needsUpdate = true;
  }

  private updateBurstParticles(dt: number): void {
    for (let i = this.burstItems.length - 1; i >= 0; i--) {
      const b = this.burstItems[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.burstItems.splice(i, 1);
        continue;
      }
      b.vel.y -= 15 * dt;
      _v2.copy(b.vel).multiplyScalar(dt);
      b.mesh.position.add(_v2);
      b.mesh.rotation.x += dt * 7;
      b.mesh.rotation.y += dt * 5;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = b.life / b.maxLife;
    }

    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer -= dt;
      const p = 1 - this.shockwaveTimer / 0.45;
      this.shockwaveRing.scale.setScalar(1 + p * 4.5);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p);
      if (this.shockwaveTimer <= 0) this.shockwaveRing.visible = false;
    }
  }

  private emitHudSnapshot(): void {
    const activePowerUps: ActivePowerUp[] = [];
    for (const [type, remaining] of this.powerUps.entries()) {
      const meta = POWER_UP_META[type];
      activePowerUps.push({
        type,
        label: meta.label,
        remaining,
        duration: meta.duration,
        color: meta.color,
      });
    }

    this.callbacks.onHudUpdate({
      phase: this.phase,
      zone: this.zoneId,
      score: Math.floor(this.score),
      coins: this.coins,
      fruitsCollected: this.fruitsCollected,
      distance: Math.floor(this.distance),
      highScore: Math.max(this.highScore, Math.floor(this.score)),
      speedMultiplier: Number((this.getCurrentSpeed() / BASE_SPEED).toFixed(2)),
      dragonDistance: this.settings.dragonEnabled ? Number(this.dragonOffsetZ.toFixed(1)) : -1,
      activePowerUps,
      gameOverReason: this.gameOverReason,
      caughtByDragon: this.caughtByDragon,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    gameAudio.stopMusic();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });

    this.contactShadowTex.dispose();
    this.barkTex.dispose();
    this.snowBarkTex.dispose();
    this.stoneTex.dispose();
    Object.values(this.trackTextures).forEach((t) => t?.dispose());
    Object.values(this.skyTextures).forEach((t) => t?.dispose());

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
