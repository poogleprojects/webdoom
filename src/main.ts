import { Renderer } from './engine/Renderer';
import { Camera } from './engine/Camera';
import { InputManager } from './engine/InputManager';
import { MapLoader } from './world/MapLoader';
import { WDMap } from './world/Map';
import { TileSheetParser, TileSheet } from './assets/TileSheetParser';
import { SpriteSheetParser, SpriteSheet } from './assets/SpriteSheetParser';
import { PlaceholderTextures } from './assets/PlaceholderTextures';
import { SpriteEntity } from './entities/SpriteEntity';

let renderer: Renderer;
let camera: Camera;
let input: InputManager;
let currentMap: WDMap | null = null;
let sprites: SpriteEntity[] = [];
let wallsSheet: TileSheet;
let floorsSheet: TileSheet;
let ceilsSheet: TileSheet;
let spriteSheet: SpriteSheet;

let lastTime = 0;
let animFrameId = 0;

function gameLoop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (!currentMap) {
    animFrameId = requestAnimationFrame(gameLoop);
    return;
  }

  camera.update(dt, input, currentMap);
  for (const s of sprites) {
    s.update(dt, camera.pos[0], camera.pos[1]);
  }

  renderer.drawWorld(camera, currentMap, wallsSheet.texture, floorsSheet.texture, ceilsSheet.texture);
  renderer.drawSprites(camera, sprites, spriteSheet);

  animFrameId = requestAnimationFrame(gameLoop);
}

async function startLevel(url: string): Promise<void> {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  const map = await MapLoader.load(renderer.gl, url);
  currentMap = map;

  sprites = map.sprites.map(sd => new SpriteEntity(sd.x, sd.y, sd.type, sd.fps));

  const sp = map.meta.spawnPoint;
  camera = new Camera(sp.x, sp.y, sp.angle);

  document.getElementById('overlay')!.style.display = 'none';

  lastTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

async function loadTexture<T>(
  label: string,
  loader: () => Promise<T>
): Promise<T> {
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

  document.getElementById('btn-level1')!.addEventListener('click', () =>
    startLevel('/maps/level1.wdmap.json'));
  document.getElementById('btn-level2')!.addEventListener('click', () =>
    startLevel('/maps/level2.wdmap.json'));

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.resize(canvas.width, canvas.height);
  });

  lastTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

main().catch(console.error);