import * as THREE from 'three';
import type { CollectibleKind, PowerUpType, ZoneConfig } from './types';
import { POWER_UP_META } from './zones';

export interface KnightRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  cape: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  fireAura: THREE.Mesh;
  shieldBubble: THREE.Mesh;
  magnetRing: THREE.Mesh;
  lightningRing: THREE.Mesh;
  frostAura: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export interface DragonRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  neckGroup: THREE.Group;
  headGroup: THREE.Group;
  jawGroup: THREE.Group;
  leftWingInner: THREE.Group;
  leftWingOuter: THREE.Group;
  rightWingInner: THREE.Group;
  rightWingOuter: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tailSegments: THREE.Group[];
  breathCone: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
  wingMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshStandardMaterial;
}

export function createKnightModel(contactShadowTex: THREE.Texture): KnightRig {
  const root = new THREE.Group();

  // Contact shadow grounded at y = 0.02
  const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Materials with clear roughness & metalness contrast
  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 0.35,
  });
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.48,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.18,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    metalness: 0.02,
    roughness: 0.86,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x4a2e1b,
    metalness: 0.05,
    roughness: 0.78,
  });
  const visorGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  // Torso (bottom at ~0.85 above ground)
  const torso = new THREE.Group();
  torso.position.y = 0.98;
  bodyPivot.add(torso);

  // Breastplate
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.44), steelMat);
  chest.position.y = 0.28;
  chest.castShadow = true;
  torso.add(chest);

  // Gold chest crest
  const chestCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), goldTrimMat);
  chestCrest.scale.set(1, 1.35, 0.55);
  chestCrest.position.set(0, 0.34, -0.22);
  torso.add(chestCrest);

  // Waist / Leather Belt + Tassets
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.48), leatherMat);
  belt.position.y = -0.06;
  belt.castShadow = true;
  torso.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.51), goldTrimMat);
  buckle.position.y = -0.06;
  torso.add(buckle);

  // Shoulder Pauldrons
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
      steelMat,
    );
    pauldron.position.set(side * 0.44, 0.58, 0);
    pauldron.rotation.z = side * -0.25;
    pauldron.castShadow = true;
    torso.add(pauldron);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), goldTrimMat);
    trim.position.set(side * 0.44, 0.52, 0);
    trim.rotation.x = Math.PI / 2;
    torso.add(trim);
  }

  // Crimson Cape (hinged at upper back, extends toward +Z)
  const capeGeo = new THREE.PlaneGeometry(0.72, 1.12, 4, 6);
  capeGeo.translate(0, -0.56, 0);
  const capeMat = clothMat.clone();
  capeMat.side = THREE.DoubleSide;
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 0.58, 0.24);
  cape.rotation.x = 0.28;
  cape.castShadow = true;
  torso.add(cape);

  // Head & Helmet
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0);
  torso.add(head);

  const helmBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.42, 12), steelMat);
  helmBase.position.y = 0.22;
  helmBase.castShadow = true;
  head.add(helmBase);

  const helmDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    steelMat,
  );
  helmDome.position.y = 0.41;
  helmDome.castShadow = true;
  head.add(helmDome);

  // Faceplate visor (faces -Z forward direction)
  const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.08), visorGlowMat);
  visorSlit.position.set(0, 0.26, -0.22);
  head.add(visorSlit);

  const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.12), darkIronMat);
  chinGuard.position.set(0, 0.12, -0.2);
  head.add(chinGuard);

  // Helmet Crest & Flowing Crimson Plume
  const plumeHolder = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.28), goldTrimMat);
  plumeHolder.position.set(0, 0.64, 0.02);
  head.add(plumeHolder);

  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 8), clothMat);
  plume.position.set(0, 0.68, 0.24);
  plume.rotation.x = Math.PI * 0.42;
  plume.castShadow = true;
  head.add(plume);

  // Left Arm + Kite Shield
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.46, 0.52, 0);
  torso.add(leftArm);

  const lUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.46, 8), darkIronMat);
  lUpper.position.y = -0.23;
  lUpper.castShadow = true;
  leftArm.add(lUpper);

  const lGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), steelMat);
  lGauntlet.position.y = -0.46;
  leftArm.add(lGauntlet);

  // Kite Shield mounted on left arm
  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(-0.14, -0.34, -0.14);
  shieldGroup.rotation.y = Math.PI * 0.38;
  leftArm.add(shieldGroup);

  const shieldBody = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.07), darkIronMat);
  shieldBody.castShadow = true;
  shieldGroup.add(shieldBody);

  const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.04), goldTrimMat);
  shieldRim.position.z = -0.02;
  shieldGroup.add(shieldRim);

  const shieldBoss = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 6), goldTrimMat);
  shieldBoss.rotation.x = -Math.PI / 2;
  shieldBoss.position.z = -0.08;
  shieldGroup.add(shieldBoss);

  // Right Arm + Silver Broadsword
  const rightArm = new THREE.Group();
  rightArm.position.set(0.46, 0.52, 0);
  torso.add(rightArm);

  const rUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.46, 8), darkIronMat);
  rUpper.position.y = -0.23;
  rUpper.castShadow = true;
  rightArm.add(rUpper);

  const rGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), steelMat);
  rGauntlet.position.y = -0.46;
  rightArm.add(rGauntlet);

  // Sword
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0.02, -0.5, -0.16);
  swordGroup.rotation.x = -Math.PI * 0.35;
  rightArm.add(swordGroup);

  const swordHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), leatherMat);
  swordGroup.add(swordHilt);

  const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.07), goldTrimMat);
  swordGuard.position.y = 0.12;
  swordGroup.add(swordGuard);

  const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.025), steelMat);
  swordBlade.position.y = 0.56;
  swordBlade.castShadow = true;
  swordGroup.add(swordBlade);

  const swordTip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 4), steelMat);
  swordTip.position.y = 1.07;
  swordTip.rotation.y = Math.PI / 4;
  swordGroup.add(swordTip);

  // Legs (hinged at y = 0.86)
  const makeLeg = (xOffset: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.86, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.105, 0.42, 8), darkIronMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    leg.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 8), goldTrimMat);
    knee.position.y = -0.42;
    leg.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.38, 8), steelMat);
    shin.position.y = -0.61;
    shin.castShadow = true;
    leg.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.34), darkIronMat);
    boot.position.set(0, -0.79, -0.05);
    boot.castShadow = true;
    leg.add(boot);

    return leg;
  };

  const leftLeg = makeLeg(-0.18);
  const rightLeg = makeLeg(0.18);
  bodyPivot.add(leftLeg);
  bodyPivot.add(rightLeg);

  // Power-Up Aura Meshes (toggled dynamically)
  const fireAura = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.08, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 }),
  );
  fireAura.rotation.x = Math.PI / 2;
  fireAura.position.y = 1.0;
  fireAura.visible = false;
  bodyPivot.add(fireAura);

  const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,
    }),
  );
  shieldBubble.position.y = 1.1;
  shieldBubble.visible = false;
  bodyPivot.add(shieldBubble);

  const magnetRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.8 }),
  );
  magnetRing.rotation.x = Math.PI / 2;
  magnetRing.position.y = 0.35;
  magnetRing.visible = false;
  bodyPivot.add(magnetRing);

  const lightningRing = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.95, 0.035, 36, 6, 2, 3),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.75 }),
  );
  lightningRing.position.y = 1.1;
  lightningRing.visible = false;
  bodyPivot.add(lightningRing);

  const frostAura = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.25, 0),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    }),
  );
  frostAura.position.y = 1.1;
  frostAura.visible = false;
  bodyPivot.add(frostAura);

  return {
    root,
    bodyPivot,
    torso,
    head,
    cape,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    fireAura,
    shieldBubble,
    magnetRing,
    lightningRing,
    frostAura,
    contactShadow,
  };
}

export function createDragonModel(scale = 1): DragonRig {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    roughness: 0.55,
    metalness: 0.2,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.65,
    metalness: 0.1,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.72,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.45,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xff6b00,
    emissive: 0xff4500,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.85;
  root.add(bodyGroup);

  // Main scaly torso (facing -Z toward the knight!)
  const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(0.92, 1), bodyMat);
  chest.scale.set(0.95, 0.85, 1.55);
  chest.castShadow = true;
  bodyGroup.add(chest);

  const bellyPlates = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.48, 2.0, 8), bellyMat);
  bellyPlates.rotation.x = Math.PI / 2;
  bellyPlates.position.y = -0.32;
  bodyGroup.add(bellyPlates);

  // Dorsal spine ridges
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 5), hornMat);
    spike.position.set(0, 0.76, -0.7 + i * 0.48);
    spike.rotation.x = 0.35;
    bodyGroup.add(spike);
  }

  // Articulated Neck + Head + Snapping Jaw
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.32, -1.15);
  bodyGroup.add(neckGroup);

  const neckSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.5, 1.15, 8), bodyMat);
  neckSeg.rotation.x = Math.PI * 0.35;
  neckSeg.position.set(0, 0.25, -0.35);
  neckSeg.castShadow = true;
  neckGroup.add(neckSeg);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, -0.82);
  neckGroup.add(headGroup);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.54, 0.96), bodyMat);
  skull.position.set(0, 0.14, -0.22);
  skull.castShadow = true;
  headGroup.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.65), bodyMat);
  snout.position.set(0, 0.08, -0.86);
  snout.castShadow = true;
  headGroup.add(snout);

  // Curved Horns
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.78, 6), hornMat);
    horn.position.set(side * 0.32, 0.5, 0.16);
    horn.rotation.x = -0.68;
    horn.rotation.z = side * -0.25;
    headGroup.add(horn);

    // Molten glowing eyes
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glowMat);
    eye.position.set(side * 0.31, 0.24, -0.52);
    headGroup.add(eye);
  }

  // Lower Jaw (hinged to open & roar!)
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.05, -0.35);
  headGroup.add(jawGroup);

  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.78), bellyMat);
  lowerJaw.position.set(0, -0.08, -0.36);
  jawGroup.add(lowerJaw);

  // Fangs
  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    fang.position.set(side * 0.16, 0.04, -0.68);
    jawGroup.add(fang);
  }

  // Fire Breath Cone (emitted from mouth)
  const breathCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 2.2, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  breathCone.rotation.x = Math.PI / 2;
  breathCone.position.set(0, -0.04, -1.75);
  breathCone.visible = false;
  headGroup.add(breathCone);

  // Articulated Wings (Inner + Outer segments)
  const makeWing = (side: -1 | 1) => {
    const inner = new THREE.Group();
    inner.position.set(side * 0.65, 0.48, -0.25);

    const armBone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.55, 6), bodyMat);
    armBone.rotation.z = side * -Math.PI / 2;
    armBone.position.x = side * 0.78;
    inner.add(armBone);

    const innerMembrane = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), wingMat);
    innerMembrane.rotation.x = -Math.PI / 2;
    innerMembrane.position.set(side * 0.78, -0.04, 0.52);
    innerMembrane.castShadow = true;
    inner.add(innerMembrane);

    const outer = new THREE.Group();
    outer.position.set(side * 1.55, 0, 0);
    inner.add(outer);

    const outerBone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.65, 6), hornMat);
    outerBone.rotation.z = side * -Math.PI / 2;
    outerBone.position.x = side * 0.82;
    outer.add(outerBone);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.7 * side, 0.15);
    wingShape.lineTo(1.25 * side, -1.25);
    wingShape.lineTo(0, -1.05);
    wingShape.closePath();
    const outerMembrane = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), wingMat);
    outerMembrane.rotation.x = Math.PI / 2;
    outerMembrane.castShadow = true;
    outer.add(outerMembrane);

    bodyGroup.add(inner);
    return { inner, outer };
  };

  const lw = makeWing(-1);
  const rw = makeWing(1);

  // Clawed Legs
  const makeDragonLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.62, -0.35, 0.25);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.9, 7), bodyMat);
    thigh.position.y = -0.45;
    thigh.castShadow = true;
    leg.add(thigh);

    const clawFoot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.56), hornMat);
    clawFoot.position.set(0, -0.92, -0.14);
    leg.add(clawFoot);
    bodyGroup.add(leg);
    return leg;
  };
  const leftLeg = makeDragonLeg(-1);
  const rightLeg = makeDragonLeg(1);

  // Segmented Whip Tail
  const tailSegments: THREE.Group[] = [];
  let parentTail: THREE.Object3D = bodyGroup;
  for (let i = 0; i < 4; i++) {
    const segGroup = new THREE.Group();
    segGroup.position.set(0, i === 0 ? -0.1 : 0, i === 0 ? 1.15 : 0.72);
    const radius = 0.34 - i * 0.065;
    const segMesh = new THREE.Mesh(new THREE.ConeGeometry(radius, 0.78, 7), bodyMat);
    segMesh.rotation.x = Math.PI / 2;
    segMesh.position.z = 0.36;
    segGroup.add(segMesh);

    if (i === 3) {
      const tailSpade = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), hornMat);
      tailSpade.scale.set(1.3, 0.3, 1.8);
      tailSpade.position.z = 0.72;
      segGroup.add(tailSpade);
    }
    parentTail.add(segGroup);
    tailSegments.push(segGroup);
    parentTail = segGroup;
  }

  return {
    root,
    bodyGroup,
    neckGroup,
    headGroup,
    jawGroup,
    leftWingInner: lw.inner,
    leftWingOuter: lw.outer,
    rightWingInner: rw.inner,
    rightWingOuter: rw.outer,
    leftLeg,
    rightLeg,
    tailSegments,
    breathCone,
    bodyMat,
    wingMat,
    glowMat,
  };
}

export function applyZoneToDragon(dragon: DragonRig, zone: ZoneConfig): void {
  dragon.bodyMat.color.setHex(zone.dragonBodyHex);
  dragon.wingMat.color.setHex(zone.dragonWingHex);
  dragon.glowMat.color.setHex(zone.dragonGlowHex);
  dragon.glowMat.emissive.setHex(zone.dragonGlowHex);
}

export function createCollectibleModel(kind: CollectibleKind): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'coin') {
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.94,
      roughness: 0.16,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 16), coinMat);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    g.add(rim);

    const crest = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.9, roughness: 0.12 }),
    );
    crest.scale.set(1, 1, 0.45);
    g.add(crest);
    return g;
  }

  if (kind === 'apple') {
    const appleMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.8,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), appleMat);
    body.scale.set(1.05, 0.94, 1.05);
    body.castShadow = true;
    g.add(body);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 }),
    );
    stem.position.y = 0.32;
    g.add(stem);

    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.03, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 }),
    );
    leaf.position.set(0.1, 0.36, 0);
    leaf.rotation.z = 0.35;
    g.add(leaf);
    return g;
  }

  if (kind === 'banana') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.24, -0.22, 0),
      new THREE.Vector3(0.02, 0.04, 0),
      new THREE.Vector3(0.24, 0.28, 0),
    ]);
    const body = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 12, 0.11, 8, false),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38, metalness: 0.05 }),
    );
    body.castShadow = true;
    g.add(body);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.8 }),
    );
    tip.position.set(0.26, 0.31, 0);
    tip.rotation.z = -0.6;
    g.add(tip);
    return g;
  }

  if (kind === 'crown') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.35,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.24, 8), goldMat);
    g.add(base);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), goldMat);
      point.position.set(Math.cos(ang) * 0.26, 0.22, Math.sin(ang) * 0.26);
      g.add(point);
    }
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xdb2777,
        emissiveIntensity: 1.2,
        roughness: 0.1,
      }),
    );
    gem.position.y = 0.25;
    g.add(gem);
    return g;
  }

  // Magical Fruits
  const pType = kind.replace('fruit_', '') as PowerUpType;
  const meta = POWER_UP_META[pType];
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: meta.hex,
    emissive: meta.hex,
    emissiveIntensity: 0.75,
    roughness: 0.15,
    metalness: 0.25,
    clearcoat: 1.0,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), coreMat);
  core.castShadow = true;
  g.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.045, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  );
  halo.rotation.x = Math.PI / 3;
  g.add(halo);

  const crownLeaf = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.22, 5),
    new THREE.MeshStandardMaterial({ color: 0xecfccb, roughness: 0.4 }),
  );
  crownLeaf.position.y = 0.44;
  g.add(crownLeaf);

  return g;
}

export function createZoneTreeModel(zone: ZoneConfig, barkTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    roughness: 0.9,
    metalness: 0.02,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 2.2, 8), trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  g.add(trunk);

  if (zone.id === 'snow') {
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x1e4d40, roughness: 0.82 });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.68 });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45 - i * 0.28, 1.75, 8), pineMat);
      cone.position.y = 2.4 + i * 1.1;
      cone.castShadow = true;
      g.add(cone);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.18 - i * 0.22, 0.72, 8), snowCapMat);
      cap.position.y = 2.95 + i * 1.1;
      g.add(cap);
    }
  } else if (zone.id === 'forest') {
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
    const highlightMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.74 });
    const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), foliageMat);
    canopy1.position.y = 3.1;
    canopy1.castShadow = true;
    g.add(canopy1);

    const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), highlightMat);
    canopy2.position.set(0.45, 4.05, 0.2);
    canopy2.castShadow = true;
    g.add(canopy2);

    // Magical glowing blossom
    const glowBud = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x4de8a8,
        emissive: 0x10b981,
        emissiveIntensity: 1.5,
      }),
    );
    glowBud.position.set(-0.4, 1.9, 0.35);
    g.add(glowBud);
  } else {
    // Mountain twisted juniper / rock spire tree
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 });
    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), canopyMat);
    c1.scale.set(1.2, 0.7, 1.2);
    c1.position.y = 2.4;
    c1.castShadow = true;
    g.add(c1);

    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.78, 0), canopyMat);
    c2.scale.set(1.1, 0.65, 1.1);
    c2.position.set(-0.35, 3.05, 0.15);
    g.add(c2);
  }

  return g;
}
