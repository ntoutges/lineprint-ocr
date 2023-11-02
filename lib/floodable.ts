import Jimp = require("jimp");
import { getPixelAt, setPixelAt } from "./jimpable.js";

const dirs = [
  [-1,0],
  [1,0],
  [0,-1],
  [0,1],
]
export function floodFillUntil(
  img: Jimp,
  x: number,
  y: number,
  limit: number,
): number {
  const blacklist = new Set<number>();
  
  const queue: [x:number,y:number][] = [[x,y]];
  const width = img.bitmap.width;
  blacklist.add(x + y*width);

  while (queue.length > 0) {
    const [x1,y1] = queue.pop();
    limit--; // account for current pixel
    if (limit <= 0) return 0;

    for (const dir of dirs) {
      const wx = x1 + dir[0];
      const wy = y1 + dir[1];
      if (blacklist.has(wx + wy*width)) continue; // already checked
      blacklist.add(wx + wy*width);

      const val = getPixelAt(img, wx, wy);
      if (val == 0xFF) continue; // not a pixel of interest

      // limit = floodFillUntil(img, wx,wy, limit, blacklist);
      queue.push([wx,wy]);
      // if (limit <= 0) return 0;
    }
  }
  return limit;
}

export function floodFill(
  img: Jimp,
  x: number,
  y: number
) {
  const queue: [x:number,y:number][] = [[x,y]];
  
  while (queue.length > 0) {
    const [x1,y1] = queue.pop();
    setPixelAt(img, x1,y1, 0xff);
    for (const dir of dirs) {
      const wx = x1 + dir[0];
      const wy = y1 + dir[1];

      const val = getPixelAt(img, wx, wy);
      if (val == 0xFF) continue; // not a pixel of interest

      // floodFill(img, wx,wy);
      queue.push([wx,wy]);
    }
  }
}

export function floodFillAdd(
  img: Jimp,
  x: number,
  y: number,
  blacklist: Set<number>
) {
  const queue: [x:number,y:number][] = [[x,y]];

  const width = img.bitmap.width;
  blacklist.add(x + y*width);
  
  while (queue.length > 0) {
    const [x1,y1] = queue.pop();
    
    for (const dir of dirs) {
      const wx = x1 + dir[0];
      const wy = y1 + dir[1];
      
      const val = getPixelAt(img, wx, wy);
      if (val == 0xFF || blacklist.has(wx + width*wy)) continue; // not a pixel of interest
      blacklist.add(wx + width*wy);

      queue.push([wx,wy]);
    }
  }
}

export type Bounds = {
  x: number,
  y: number,
  x2: number,
  y2: number,
  w: number,
  h: number
};

export function floodFillBounds(
  img: Jimp,
  x: number,
  y: number
): Bounds {
  const blacklist = new Set<number>();
  const queue: [x:number,y:number][] = [[x,y]];

  const width = img.bitmap.width;
  
  let minX = x;
  let maxX = x;
  let minY = y;
  let maxY = y;

  while (queue.length > 0) {
    const [x1,y1] = queue.pop();
    
    for (const dir of dirs) {
      const wx = x1 + dir[0];
      const wy = y1 + dir[1];
      
      const val = getPixelAt(img, wx, wy);
      if (val == 0xFF || blacklist.has(wx + width*wy)) continue; // not a pixel of interest
      blacklist.add(wx + width*wy);

      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);

      queue.push([wx,wy]);
    }
  }

  return {
    x: minX,
    y: minY,
    x2: maxX,
    y2: maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
}
