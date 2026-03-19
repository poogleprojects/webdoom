export class SpriteAnimator {
  monsterType: number;
  fps: number;
  frameCount: number;
  currentFrame: number = 0;
  private _elapsed: number = 0;

  constructor(monsterType: number, fps: number, frameCount = 7) {
    this.monsterType = monsterType;
    this.fps = fps;
    this.frameCount = frameCount;
  }

  update(dt: number): void {
    this._elapsed += dt;
    const frameDuration = 1.0 / this.fps;
    while (this._elapsed >= frameDuration) {
      this._elapsed -= frameDuration;
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
    }
  }
}
