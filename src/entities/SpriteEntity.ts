import { SpriteAnimator } from './SpriteAnimator';

const MONSTER_SPEED = 1.5;   // tiles/sec
const DETECT_RANGE = 8.0;    // tiles
const ATTACK_RANGE = 0.6;    // tiles

export class SpriteEntity {
  x: number;
  y: number;
  animator: SpriteAnimator;
  distToPlayer: number = 0;
  active: boolean = true;
  playerHit: boolean = false;

  constructor(x: number, y: number, monsterType: number, fps: number) {
    this.x = x;
    this.y = y;
    this.animator = new SpriteAnimator(monsterType, fps);
  }

  update(dt: number, playerX: number, playerY: number, tiles: number[][]): void {
    if (!this.active) return;

    this.animator.update(dt);
    const dx = this.x - playerX;
    const dy = this.y - playerY;
    this.distToPlayer = Math.sqrt(dx * dx + dy * dy);

    // Attack when close enough
    if (this.distToPlayer < ATTACK_RANGE) {
      this.active = false;
      this.playerHit = true;
      return;
    }

    // Chase the player if within detection range
    if (this.distToPlayer < DETECT_RANGE) {
      const len = this.distToPlayer;
      if (len > 0.001) {
        const ndx = (playerX - this.x) / len;
        const ndy = (playerY - this.y) / len;
        const step = MONSTER_SPEED * dt;
        const nx = this.x + ndx * step;
        const ny = this.y + ndy * step;
        const rows = tiles.length;
        const cols = tiles[0]?.length ?? 0;

        // Slide along walls: check each axis independently
        const txNew = Math.floor(nx);
        const tyOld = Math.floor(this.y);
        if (txNew >= 0 && txNew < cols && tyOld >= 0 && tyOld < rows) {
          const tv = tiles[tyOld][txNew];
          if (tv === 0 || tv === 9) this.x = nx;
        }
        const txOld = Math.floor(this.x);
        const tyNew = Math.floor(ny);
        if (txOld >= 0 && txOld < cols && tyNew >= 0 && tyNew < rows) {
          const tv = tiles[tyNew][txOld];
          if (tv === 0 || tv === 9) this.y = ny;
        }
      }
    }
  }
}
