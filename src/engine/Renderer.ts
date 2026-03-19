import { Camera } from './Camera';
import { WDMap } from '../world/Map';
import { SpriteEntity } from '../entities/SpriteEntity';
import { SpriteSheet } from '../assets/SpriteSheetParser';
import raycasterVert from '../shaders/raycaster.vert.glsl?raw';
import raycasterFrag from '../shaders/raycaster.frag.glsl?raw';
import spriteVert from '../shaders/sprite.vert.glsl?raw';
import spriteFrag from '../shaders/sprite.frag.glsl?raw';

// Simple blit shaders: draw a texture onto a fullscreen quad
const blitVertSrc = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const blitFragSrc = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
void main() {
  fragColor = texture(u_tex, v_uv);
}`;

export class Renderer {
  gl: WebGL2RenderingContext;
  private width: number = 0;
  private height: number = 0;
  private _ambientColor: [number, number, number] = [1, 1, 1];

  // Raycaster pass
  private rcProgram!: WebGLProgram;
  private rcQuadVAO!: WebGLVertexArrayObject;

  // Sprite pass
  private spProgram!: WebGLProgram;
  private spVAO!: WebGLVertexArrayObject;
  private spVBO!: WebGLBuffer;

  // Blit pass (FBO color -> default framebuffer, avoids blitFramebuffer on MSAA default FB)
  private blitProgram!: WebGLProgram;
  private blitVAO!: WebGLVertexArrayObject;

  // FBO
  private fbo!: WebGLFramebuffer;
  private colorTex!: WebGLTexture;
  private depthTex!: WebGLTexture;

  constructor(canvas: HTMLCanvasElement) {
    // Request a non-antialiased context to avoid multisampled default framebuffer issues
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;

    // Enable EXT_color_buffer_float for R32F FBO attachment
    gl.getExtension('EXT_color_buffer_float');

    this._initShaders();
    this._initQuad();
    this._initSpriteVAO();
    this._initBlitPass();
    this.resize(canvas.width, canvas.height);
  }

  private _compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
    }
    return sh;
  }

  private _linkProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.gl;
    const vs = this._compileShader(gl.VERTEX_SHADER, vert);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private _initShaders(): void {
    this.rcProgram = this._linkProgram(raycasterVert, raycasterFrag);
    this.spProgram = this._linkProgram(spriteVert, spriteFrag);
  }

  private _initBlitPass(): void {
    const gl = this.gl;
    this.blitProgram = this._linkProgram(blitVertSrc, blitFragSrc);

    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.blitProgram, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.blitVAO = vao;
  }

  private _initQuad(): void {
    const gl = this.gl;
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.rcProgram, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.rcQuadVAO = vao;
  }

  private _initSpriteVAO(): void {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // 4 verts * (2 pos + 2 uv) * 4 bytes
    gl.bufferData(gl.ARRAY_BUFFER, 4 * 4 * 4, gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(this.spProgram, 'a_position');
    const uvLoc = gl.getAttribLocation(this.spProgram, 'a_texcoord');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    this.spVAO = vao;
    this.spVBO = vbo;
  }

  resize(w: number, h: number): void {
    const gl = this.gl;
    this.width = w;
    this.height = h;
    gl.viewport(0, 0, w, h);

    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.colorTex) gl.deleteTexture(this.colorTex);
    if (this.depthTex) gl.deleteTexture(this.depthTex);

    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    // COLOR_ATTACHMENT0: RGBA8 scene color
    this.colorTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.colorTex, 0);

    // COLOR_ATTACHMENT1: R32F depth buffer for sprite depth test
    this.depthTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.depthTex, 0);

    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn('FBO incomplete:', status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setAmbientColor(r: number, g: number, b: number): void {
    this._ambientColor = [r, g, b];
  }

  drawWorld(
    camera: Camera,
    map: WDMap,
    wallsTex: WebGLTexture,
    floorsTex: WebGLTexture,
    ceilsTex: WebGLTexture,
    time: number = 0
  ): void {
    const gl = this.gl;
    const prog = this.rcProgram;

    // --- Pass 1: render raycasted scene into FBO ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_playerPos'), camera.pos[0], camera.pos[1]);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_playerDir'), camera.dir[0], camera.dir[1]);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_cameraPlane'), camera.plane[0], camera.plane[1]);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.width, this.height);

    const fog = map.meta.fogColor;
    gl.uniform1f(gl.getUniformLocation(prog, 'u_fogDist'), map.meta.fogDist);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_fogColor'), fog[0], fog[1], fog[2]);

    const amb = this._ambientColor;
    gl.uniform3f(gl.getUniformLocation(prog, 'u_ambientColor'), amb[0], amb[1], amb[2]);

    gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), time);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_mapSize'), map.meta.width, map.meta.height);

    const sector = map.sectors[0];
    gl.uniform1f(gl.getUniformLocation(prog, 'u_floorTileID'), sector.floorTileID);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_ceilTileID'), sector.ceilTileID);

    const tileTexturesArr = new Float32Array(36);
    for (const [key, val] of Object.entries(map.tileTextures)) {
      const k = parseInt(key);
      if (k >= 0 && k < 36) tileTexturesArr[k] = val as number;
    }
    gl.uniform1fv(gl.getUniformLocation(prog, 'u_tileTextures'), tileTexturesArr);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, map.mapTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_mapTex'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, wallsTex);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_wallsTex'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, floorsTex);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_floorsTex'), 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, ceilsTex);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_ceilsTex'), 3);

    gl.bindVertexArray(this.rcQuadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // --- Blit pass: draw FBO color texture to default framebuffer via fullscreen quad ---
    // (avoids glBlitFramebuffer which fails when the default FB is multisampled)
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.blitProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.uniform1i(gl.getUniformLocation(this.blitProgram, 'u_tex'), 0);
    gl.bindVertexArray(this.blitVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  drawSprites(
    camera: Camera,
    sprites: SpriteEntity[],
    spriteSheet: SpriteSheet
  ): void {
    const gl = this.gl;
    const prog = this.spProgram;
    const w = this.width, h = this.height;

    const sorted = [...sprites].sort((a, b) => b.distToPlayer - a.distToPlayer);

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_zBuffer'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, spriteSheet.texture);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_spriteSheet'), 1);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), w, h);

    const [dirX, dirY] = camera.dir;
    const [planeX, planeY] = camera.plane;
    const [posX, posY] = camera.pos;

    const det = planeX * dirY - dirX * planeY;
    if (Math.abs(det) < 1e-10) return;
    const invDet = 1.0 / det;

    for (const sprite of sorted) {
      const dx = sprite.x - posX;
      const dy = sprite.y - posY;

      const transformX = invDet * (dirY * dx - dirX * dy);
      const transformY = invDet * (-planeY * dx + planeX * dy);

      if (transformY <= 0.01) continue;

      const spriteScreenX = (w / 2) * (1.0 + transformX / transformY);
      const spriteHeight = Math.abs(h / transformY);
      const spriteWidth = spriteHeight;

      const x0 = spriteScreenX - spriteWidth / 2;
      const x1 = spriteScreenX + spriteWidth / 2;
      const y0 = h / 2 - spriteHeight / 2;
      const y1 = h / 2 + spriteHeight / 2;

      const ndcX0 = (x0 / w) * 2 - 1;
      const ndcX1 = (x1 / w) * 2 - 1;
      const ndcY0 = 1 - (y1 / h) * 2;
      const ndcY1 = 1 - (y0 / h) * 2;

      // Interleaved: pos(xy) + uv(xy) per vertex, triangle strip order
      const verts = new Float32Array([
        ndcX0, ndcY0, 0.0, 1.0,
        ndcX1, ndcY0, 1.0, 1.0,
        ndcX0, ndcY1, 0.0, 0.0,
        ndcX1, ndcY1, 1.0, 0.0,
      ]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.spVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);

      gl.uniform1f(gl.getUniformLocation(prog, 'u_monsterType'), sprite.animator.monsterType);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_currentFrame'), sprite.animator.currentFrame);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_spriteDepth'), transformY);

      gl.bindVertexArray(this.spVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    gl.disable(gl.BLEND);
  }
}