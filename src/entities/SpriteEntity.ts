import { SpriteAnimator } from './SpriteAnimator';

export class SpriteEntity {
  x: number;
  y: number;
  animator: SpriteAnimator;
  distToPlayer: number = 0;

  constructor(x: number, y: number, monsterType: number, fps: number) {
    this.x = x;
    this.y = y;
    this.animator = new SpriteAnimator(monsterType, fps);
  }

  update(dt: number, playerX: number, playerY: number): void {
    this.animator.update(dt);
    const dx = this.x - playerX;
    const dy = this.y - playerY;
    this.distToPlayer = Math.sqrt(dx * dx + dy * dy);
  }
}
