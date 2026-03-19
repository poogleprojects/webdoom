import { WDMap } from './Map';

export class MapLoader {
  static async load(gl: WebGL2RenderingContext, url: string): Promise<WDMap> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load map: ${url}`);
    const raw = await res.json();

    const { meta, tiles, tileTextures, sectors, sprites } = raw;

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
