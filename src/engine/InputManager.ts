export class InputManager {
  private keys = new Set<string>();
  private _mouseDX: number = 0;
  private _pointerLocked: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
    });
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this._pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', e => {
      if (this._pointerLocked) this._mouseDX += e.movementX;
    });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  consumeMouseDX(): number {
    const dx = this._mouseDX;
    this._mouseDX = 0;
    return dx;
  }
}