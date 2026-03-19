export interface SpriteSheet {
  texture: WebGLTexture;
  monsterCount: number;
  frameCount: number;
  frameU: number;
  frameV: number;
}

export class SpriteSheetParser {
  static async load(
    gl: WebGL2RenderingContext,
    path: string,
    fallback?: () => HTMLCanvasElement
  ): Promise<SpriteSheet> {
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
        throw new Error(`Failed to load sprite sheet: ${path}`);
      }
    }

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return {
      texture,
      monsterCount: 5,
      frameCount: 7,
      frameU: 1.0 / 7.0,
      frameV: 1.0 / 5.0,
    };
  }
}
