export interface TileSheet {
  texture: WebGLTexture;
  cols: number;
  rows: number;
  tileCount: number;
}

export class TileSheetParser {
  static async load(
    gl: WebGL2RenderingContext,
    path: string,
    cols = 5,
    rows = 5,
    fallback?: () => HTMLCanvasElement
  ): Promise<TileSheet> {
    let source: HTMLImageElement | HTMLCanvasElement;
    try {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = path;
      });
    } catch {
      if (fallback) {
        source = fallback();
      } else {
        throw new Error(`Failed to load texture: ${path}`);
      }
    }

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);

    return { texture, cols, rows, tileCount: cols * rows };
  }
}
