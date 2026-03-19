import { WDMap } from './Map';

export class MapLoader {
  static async load(gl: WebGL2RenderingContext, url: string): Promise<WDMap> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load map: ${url}`);
    const raw = await res.json();

    const { tileTextures, sectors, sprites } = raw;
    // Clone meta so we can override spawnPoint at runtime
    const meta = { ...raw.meta };
    if (!meta.ambientColor) meta.ambientColor = [1.0, 1.0, 1.0];

    // Deep-copy tiles so we can mutate without touching raw JSON
    const tiles: number[][] = raw.tiles.map((row: number[]) => [...row]);

    // ---- Randomise spawn + exit each run ----
    const openTiles: [number, number][] = [];
    for (let row = 0; row < meta.height; row++) {
      for (let col = 0; col < meta.width; col++) {
        if (tiles[row][col] === 0) openTiles.push([col, row]);
      }
    }
    if (openTiles.length < 2) throw new Error(`Map ${url} needs at least 2 open tiles`);

    // Fisher-Yates shuffle
    for (let i = openTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [openTiles[i], openTiles[j]] = [openTiles[j], openTiles[i]];
    }

    // Spawn at first shuffled tile
    const [spawnCol, spawnRow] = openTiles[0];
    meta.spawnPoint = {
      x: spawnCol + 0.5,
      y: spawnRow + 0.5,
      angle: Math.random() * Math.PI * 2,
    };

    // Exit at last shuffled tile (maximally far in shuffled order)
    const [exitCol, exitRow] = openTiles[openTiles.length - 1];
    tiles[exitRow][exitCol] = 9;
    // ---- End randomisation ----

    // Pack 2D tiles into flat Uint8Array
    const tileData = new Uint8Array(meta.width * meta.height);
    for (let row = 0; row < meta.height; row++) {
      for (let col = 0; col < meta.width; col++) {
        tileData[row * meta.width + col] = tiles[row][col];
      }
    }

    // Upload as R8UI texture
    const mapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, mapTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R8UI,
      meta.width, meta.height, 0,
      gl.RED_INTEGER, gl.UNSIGNED_BYTE, tileData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return { meta, tiles, tileTextures, sectors, sprites, tileData, mapTexture };
  }
}
