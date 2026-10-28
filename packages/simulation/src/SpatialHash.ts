export class SpatialHash<Item extends { x: number; y: number }> {
  private readonly cells = new Map<string, Item[]>();
  private readonly cellSize: number;

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  rebuild(items: Iterable<Item>): void {
    for (const cell of this.cells.values()) cell.length = 0;
    for (const item of items) {
      const key = `${Math.floor(item.x / this.cellSize)},${Math.floor(item.y / this.cellSize)}`;
      const cell = this.cells.get(key);
      if (cell) cell.push(item);
      else this.cells.set(key, [item]);
    }
  }

  *nearby(centerX: number, centerY: number, radius: number): IterableIterator<Item> {
    for (let column = Math.floor((centerX - radius) / this.cellSize); column <= Math.floor((centerX + radius) / this.cellSize); column++) {
      for (let row = Math.floor((centerY - radius) / this.cellSize); row <= Math.floor((centerY + radius) / this.cellSize); row++) {
        const cell = this.cells.get(`${column},${row}`);
        if (!cell) continue;
        for (const item of cell) {
          if ((item.x - centerX) ** 2 + (item.y - centerY) ** 2 <= radius ** 2) yield item;
        }
      }
    }
  }
}