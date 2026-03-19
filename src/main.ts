import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { InputManager } from './engine/InputManager';
import { AudioManager } from './engine/AudioManager';
import { MapLoader } from './world/MapLoader';
import { WDMap } from './world/Map';
import { TileSheetParser, TileSheet } from './assets/TileSheetParser';
import { SpriteSheetParser, SpriteSheet } from './assets/SpriteSheetParser';
import { PlaceholderTextures } from './assets/PlaceholderTextures';
import { SpriteEntity } from './entities/SpriteEntity';

let renderer: Renderer;
let camera: Camera;
let input: InputManager;
let audio: AudioManager;
let currentMap: WDMap | null = null;
let sprites: SpriteEntity[] = [];
let wallsSheet: TileSheet;
let floorsSheet: TileSheet;
let ceilsSheet: TileSheet;
let spriteSheet: SpriteSheet;

let lastTime = 0;
let animFrameId = 0;
let currentLevelIndex = 0;
let footstepTimer = 0;
let groanTimer = 0;
let levelTransitioning = false;

const LEVEL_URLS = [
  '/maps/level1.wdmap.json',
  '/maps/level2.wdmap.json',
  '/maps/level3.wdmap.json',
  '/maps/level4.wdmap.json',
  '/maps/level5.wdmap.json',
  '/maps/level6.wdmap.json',
  '/maps/level7.wdmap.json',
  '/maps/level8.wdmap.json',
  '/maps/level9.wdmap.json',
  '/maps/level10.wdmap.json',
];

const MAX_MONSTER_TYPES = 5;
const LEVEL_COMPLETE_MS = 2000;
const VICTORY_MS = 6000;

function spawnMonsterRandom(tiles: number[][]): SpriteEntity | null {
  const open: [number, number][] = [];
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c] === 0) open.push([c, r]);
    }
  }
  if (open.length === 0) return null;
  const [col, row] = open[Math.floor(Math.random() * open.length)];
  return new SpriteEntity(col + 0.5, row + 0.5, Math.floor(Math.random() * MAX_MONSTER_TYPES), 8);
}

function showFlash(text: string, durationMs: number): void {
  const div = document.createElement('div');
  div.id = 'flash-overlay';
  div.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(0,0,0,0.75);display:flex;align-items:center;' +
    'justify-content:center;color:#ff0;font-family:monospace;font-size:3rem;' +
    'text-align:center;z-index:20;pointer-events:none;';
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), durationMs);
}

function returnToMenu(): void {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }
  if (document.pointerLockElement) document.exitPointerLock();
  levelTransitioning = false;
  currentMap = null;
  document.getElementById('overlay')!.style.display = 'flex';
  (document.getElementById('btn-menu') as HTMLButtonElement).style.display = 'none';
}

function gameLoop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!currentMap || levelTransitioning) {
    animFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  const prevX = camera.pos[0];
  const prevY = camera.pos[1];
  camera.update(dt, input, currentMap);

  // Footstep sounds while moving
  const moved = camera.pos[0] !== prevX || camera.pos[1] !== prevY;
  if (moved) {
    footstepTimer += dt;
    if (footstepTimer >= 0.4) {
      footstepTimer = 0;
      audio.playFootstep();
    }
  } else {
    footstepTimer = 0;
  }

  // Exit tile detection
  const tx = Math.floor(camera.pos[0]);
  const ty = Math.floor(camera.pos[1]);
  const rows = currentMap.tiles.length;
  const cols = currentMap.tiles[0]?.length ?? 0;
  if (ty >= 0 && ty < rows && tx >= 0 && tx < cols && currentMap.tiles[ty][tx] === 9) {
    levelTransitioning = true;
    audio.playLevelComplete();
    if (currentLevelIndex >= LEVEL_URLS.length - 1) {
      showFlash('🏆 YOU WIN! 🏆', VICTORY_MS);
      setTimeout(returnToMenu, VICTORY_MS);
    } else {
      showFlash('LEVEL COMPLETE!', LEVEL_COMPLETE_MS);
      setTimeout(() => startLevel(currentLevelIndex + 1), LEVEL_COMPLETE_MS);
    }
    animFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  // Update sprites (pass tiles for wall collision)
  for (const s of sprites) {
    s.update(dt, camera.pos[0], camera.pos[1], currentMap.tiles);
  }

  // Handle monster attacks → hurt sound + respawn
  for (const s of sprites) {
    if (s.playerHit) {
      s.playerHit = false;
      audio.playHurt();
      const replacement = spawnMonsterRandom(currentMap.tiles);
      if (replacement) sprites.push(replacement);
    }
  }

  // Remove dead sprites
  sprites = sprites.filter(s => s.active);

  // Occasional monster groans for nearby monsters
  groanTimer += dt;
  if (groanTimer >= 3.0) {
    groanTimer = 0;
    if (sprites.some(s => s.distToPlayer < 8)) {
      audio.playMonsterGroan();
    }
  }

  // Apply per-level ambient tint
  const amb = currentMap.meta.ambientColor ?? [1, 1, 1];
  renderer.setAmbientColor(amb[0], amb[1], amb[2]);

  renderer.drawWorld(camera, currentMap, wallsSheet.texture, floorsSheet.texture, ceilsSheet.texture);
  renderer.drawSprites(camera, sprites, spriteSheet);

  animFrameId = requestAnimationFrame(gameLoop);
}

async function startLevel(levelIndex: number): Promise<void> {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  levelTransitioning = false;
  currentLevelIndex = levelIndex;

  const map = await MapLoader.load(renderer.gl, LEVEL_URLS[levelIndex]);
  currentMap = map;

  sprites = map.sprites.map(sd => new SpriteEntity(sd.x, sd.y, sd.type, sd.fps));

  const sp = map.meta.spawnPoint;
  camera = new Camera(sp.x, sp.y, sp.angle);

  const amb = map.meta.ambientColor ?? [1, 1, 1];
  renderer.setAmbientColor(amb[0], amb[1], amb[2]);

  document.getElementById('overlay')!.style.display = 'none';
  (document.getElementById('btn-menu') as HTMLButtonElement).style.display = 'block';

  lastTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

async function loadTexture<T>(label: string, loader: () => Promise<T>): Promise<T> {
  try {
    const result = await loader();
    console.log(`✅ Loaded texture: ${label}`);
    return result;
  } catch (e) {
    console.warn(`⚠️ Failed to load texture: ${label} —`, e);
    throw e;
  }
}

async function main(): Promise<void> {
  const canvas = document.getElementById('webdoom') as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  renderer = new Renderer(canvas);
  const gl = renderer.gl;

  input = new InputManager(canvas);
  audio = new AudioManager();

  console.log('🎮 WebDoom: loading textures...');

  wallsSheet = await loadTexture('walls.png', () =>
    TileSheetParser.load(gl, '/textures/walls.png', 5, 5,
      () => { console.warn('⚠️ walls.png missing — using placeholder'); return PlaceholderTextures.wallSheet(); }));

  floorsSheet = await loadTexture('floors.png', () =>
    TileSheetParser.load(gl, '/textures/floors.png', 5, 5,
      () => { console.warn('⚠️ floors.png missing — using placeholder'); return PlaceholderTextures.floorSheet(); }));

  ceilsSheet = await loadTexture('ceilings.png', () =>
    TileSheetParser.load(gl, '/textures/ceilings.png', 5, 5,
      () => { console.warn('⚠️ ceilings.png missing — using placeholder'); return PlaceholderTextures.ceilSheet(); }));

  spriteSheet = await loadTexture('sprite_sheet.png', () =>
    SpriteSheetParser.load(gl, '/textures/sprite_sheet.png',
      () => { console.warn('⚠️ sprite_sheet.png missing — using placeholder'); return PlaceholderTextures.spriteSheet(); }));

  console.log('🎮 WebDoom: all textures loaded, ready to play!');

  // Level-select buttons (resume audio context on first click)
  for (let i = 0; i < LEVEL_URLS.length; i++) {
    const btn = document.getElementById(`btn-level${i + 1}`);
    if (btn) {
      btn.addEventListener('click', () => {
        audio.resume().catch(() => {});
        startLevel(i).catch(console.error);
      });
    }
  }

  // "Return to Menu" HUD button
  document.getElementById('btn-menu')!.addEventListener('click', returnToMenu);

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.resize(canvas.width, canvas.height);
  });

  lastTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

main().catch(console.error);