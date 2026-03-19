import { InputManager } from './InputManager';
import { WDMap } from '../world/Map';

export class Camera {
  pos: [number, number];
  dir: [number, number];
  plane: [number, number];

  readonly moveSpeed = 3.0; // tiles/sec
  readonly rotSpeed = 2.0;  // radians/sec
  readonly mouseSpeed = 0.002;

  constructor(x: number, y: number, angle: number) {
    this.pos = [x, y];
    this.dir = [Math.cos(angle), Math.sin(angle)];
    this.plane = [-Math.sin(angle) * 0.66, Math.cos(angle) * 0.66];
  }

  update(dt: number, input: InputManager, map: WDMap): void {
    const tiles = map.tiles;
    const [px, py] = this.pos;
    const [dx, dy] = this.dir;

    // Forward/backward — use e.code values (layout-independent)
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
      const nx = px + dx * this.moveSpeed * dt;
      const ny = py + dy * this.moveSpeed * dt;
      if (Camera._passable(tiles, Math.floor(py), Math.floor(nx))) this.pos[0] = nx;
      if (Camera._passable(tiles, Math.floor(ny), Math.floor(px))) this.pos[1] = ny;
    }
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
      const nx = px - dx * this.moveSpeed * dt;
      const ny = py - dy * this.moveSpeed * dt;
      if (Camera._passable(tiles, Math.floor(py), Math.floor(nx))) this.pos[0] = nx;
      if (Camera._passable(tiles, Math.floor(ny), Math.floor(px))) this.pos[1] = ny;
    }

    // Strafe — use e.code values (layout-independent)
    if (input.isDown('KeyA')) {
      const nx = px - this.plane[0] * this.moveSpeed * dt;
      const ny = py - this.plane[1] * this.moveSpeed * dt;
      if (Camera._passable(tiles, Math.floor(py), Math.floor(nx))) this.pos[0] = nx;
      if (Camera._passable(tiles, Math.floor(ny), Math.floor(px))) this.pos[1] = ny;
    }
    if (input.isDown('KeyD')) {
      const nx = px + this.plane[0] * this.moveSpeed * dt;
      const ny = py + this.plane[1] * this.moveSpeed * dt;
      if (Camera._passable(tiles, Math.floor(py), Math.floor(nx))) this.pos[0] = nx;
      if (Camera._passable(tiles, Math.floor(ny), Math.floor(px))) this.pos[1] = ny;
    }

    // Rotate (arrow keys + mouse)
    let rot = 0;
    if (input.isDown('ArrowLeft')) rot -= this.rotSpeed * dt;
    if (input.isDown('ArrowRight')) rot += this.rotSpeed * dt;
    rot += input.consumeMouseDX() * this.mouseSpeed;

    if (rot !== 0) this._rotate(rot);
  }

  private _rotate(angle: number): void {
    const [dx, dy] = this.dir;
    const [px, py] = this.plane;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    this.dir[0] = dx * cos - dy * sin;
    this.dir[1] = dx * sin + dy * cos;
    this.plane[0] = px * cos - py * sin;
    this.plane[1] = px * sin + py * cos;
  }

  /** Tile values the player (and monsters) can walk onto. */
  static _passable(tiles: number[][], row: number, col: number): boolean {
    if (row < 0 || col < 0 || row >= tiles.length || col >= (tiles[0]?.length ?? 0)) return false;
    const v = tiles[row][col];
    return v === 0 || v === 9;
  }
}