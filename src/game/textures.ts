import * as THREE from 'three';
import type { ZoneId } from './types';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTrackTexture(zone: ZoneId, anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);

  if (zone === 'snow') {
    ctx.fillStyle = '#d7eaf8';
    ctx.fillRect(0, 0, 512, 512);
    // Frosted stone tiles & crystalline cracks
    for (let y = 0; y < 512; y += 64) {
      for (let x = 0; x < 512; x += 64) {
        const shade = 212 + Math.floor(Math.random() * 28);
        ctx.fillStyle = `rgb(${shade - 12}, ${shade + 4}, ${Math.min(255, shade + 22)})`;
        ctx.fillRect(x + 2, y + 2, 60, 60);
      }
    }
    ctx.strokeStyle = 'rgba(130, 185, 225, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 90, sy + (Math.random() - 0.5) * 90);
      ctx.stroke();
    }
  } else if (zone === 'forest') {
    ctx.fillStyle = '#735941';
    ctx.fillRect(0, 0, 512, 512);
    // Woodland cobblestone & packed earth
    for (let i = 0; i < 160; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const rw = 24 + Math.random() * 34;
      const rh = 18 + Math.random() * 26;
      const v = 90 + Math.floor(Math.random() * 36);
      ctx.fillStyle = `rgb(${v + 24}, ${v + 8}, ${v - 14})`;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 6);
      ctx.fill();
    }
    // Subtle moss flecks
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = 'rgba(72, 130, 58, 0.35)';
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#6f5c52';
    ctx.fillRect(0, 0, 512, 512);
    // Chiseled mountain flagstones
    for (let y = 0; y < 512; y += 64) {
      const offset = (y / 64) % 2 === 0 ? 0 : 32;
      for (let x = -32; x < 512; x += 64) {
        const b = 96 + Math.floor(Math.random() * 32);
        ctx.fillStyle = `rgb(${b + 16}, ${b}, ${b - 8})`;
        ctx.fillRect(x + offset + 2, y + 2, 60, 60);
      }
    }
    ctx.strokeStyle = 'rgba(42, 28, 22, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 80, sy + (Math.random() - 0.5) * 80);
      ctx.stroke();
    }
  }

  // Subtle 3-lane guide lines
  ctx.fillStyle =
    zone === 'snow'
      ? 'rgba(110, 175, 225, 0.55)'
      : zone === 'forest'
        ? 'rgba(210, 188, 138, 0.32)'
        : 'rgba(245, 175, 95, 0.35)';
  ctx.fillRect(168, 0, 6, 512);
  ctx.fillRect(338, 0, 6, 512);

  return finalizeTexture(canvas, anisotropy, 1, 2.2);
}

export function createWoodBarkTexture(anisotropy: number, snowTop = false): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = snowTop ? '#5a493e' : '#5e3d26';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(38, 22, 12, 0.45)' : 'rgba(120, 82, 52, 0.3)';
    ctx.fillRect(Math.random() * 256, 0, 4 + Math.random() * 8, 256);
  }
  if (snowTop) {
    ctx.fillStyle = 'rgba(235, 245, 255, 0.65)';
    ctx.fillRect(0, 0, 256, 48);
  }
  return finalizeTexture(canvas, anisotropy, 1, 1);
}

export function createStoneTexture(anisotropy: number, baseHex: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(canvas, anisotropy, 1, 1);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSkyGradientTexture(topHex: number, horizonHex: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(16, 256);
  const top = new THREE.Color(topHex);
  const hor = new THREE.Color(horizonHex);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(0.62, `#${hor.getHexString()}`);
  grad.addColorStop(1, `#${hor.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
