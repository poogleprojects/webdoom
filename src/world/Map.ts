export interface MapMeta {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  spawnPoint: { x: number; y: number; angle: number };
  fogDist: number;
  fogColor: [number, number, number];
}

export interface SpriteData {
  type: number;
  x: number;
  y: number;
  fps: number;
}

export interface SectorData {
  id: number;
  floorTileID: number;
  ceilTileID: number;
}

export interface WDMap {
  meta: MapMeta;
  tiles: number[][];
  tileTextures: Record<string, number>;
  sectors: SectorData[];
  sprites: SpriteData[];
  /** Packed flat Uint8Array for WebGL upload */
  tileData: Uint8Array;
  /** WebGL texture (R8UI) */
  mapTexture: WebGLTexture | null;
}
