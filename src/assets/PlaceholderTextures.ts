export class PlaceholderTextures {
  /** Generate a 5×5 tile sheet placeholder. Each 64×64 cell gets distinct color + index text. */
  static wallSheet(): HTMLCanvasElement {
    return this._makeSheet(5, 5, 64, (ctx, _col, _row, idx) => {
      const hue = (idx * 37) % 360;
      ctx.fillStyle = `hsl(${hue},60%,35%)`;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, 62, 62);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx), 32, 32);
    });
  }

  static floorSheet(): HTMLCanvasElement {
    return this._makeSheet(5, 5, 64, (ctx, _col, _row, idx) => {
      const v = 20 + (idx * 13) % 40;
      ctx.fillStyle = `rgb(${v + 10},${v},${v - 5})`;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx), 32, 32);
    });
  }

  static ceilSheet(): HTMLCanvasElement {
    return this._makeSheet(5, 5, 64, (ctx, _col, _row, idx) => {
      const v = 15 + (idx * 11) % 30;
      ctx.fillStyle = `rgb(${v - 5},${v},${v + 15})`;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#0a0a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
      ctx.fillStyle = '#aab';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx), 32, 32);
    });
  }

  static spriteSheet(): HTMLCanvasElement {
    const COLS = 7, ROWS = 5, CELL = 64;
    const canvas = document.createElement('canvas');
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const monsterColors = ['#f44', '#4f4', '#44f', '#ff4', '#f4f'];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL, y = row * CELL;
        ctx.clearRect(x, y, CELL, CELL);
        ctx.fillStyle = monsterColors[row];
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(col), x + CELL / 2, y + CELL / 2);
      }
    }
    return canvas;
  }

  private static _makeSheet(
    cols: number,
    rows: number,
    cellSize: number,
    drawCell: (ctx: CanvasRenderingContext2D, col: number, row: number, idx: number) => void
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d')!;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.save();
        ctx.translate(col * cellSize, row * cellSize);
        drawCell(ctx, col, row, row * cols + col);
        ctx.restore();
      }
    }
    return canvas;
  }
}
