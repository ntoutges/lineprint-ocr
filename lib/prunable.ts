import Jimp = require("jimp");
import { getSetting } from "./settings.js";
import { getPixelAt, setPixelAt } from "./jimpable.js";
import { floodFillUntil } from "./floodable.js";

type PixelRegion = {
  x: number,
  y: number,
  w: number
};

type CategorizedPixelRegions = Record<number, PixelRegion[]>;
type GroupedPixelRegions = Record<number,Record<number, PixelRegion[]>[]>;

export function prunePrunableRegions(
  img: Jimp,
  finalists: CategorizedPixelRegions
) {
  const limit = getSetting<number>("horizontalPrune.size-check-limit");
  if (limit <= 0) return finalists; // no need to do wasted work
  
  const toDelete: Record<number, number[]> = {};

  for (const y in finalists) {
    for (const i in finalists[y]) {
      const finalist = finalists[y][i];
      // pixels where region above finalist is black
      let xStartAbove = -1;
      let xStartBelow = -1;

      // remove region and look for places to start flood-fill
      for (let x = finalist.x; x < finalist.x + finalist.w; x++) {
        setPixelAt(img, x, +y, 0xFF);
        
        if (xStartAbove == -1 && getPixelAt(img, x,+y-1, 0xFF) != 0xFF) { // pixel above is black
          xStartAbove = x;
        }
        if (xStartBelow == -1 && getPixelAt(img, x,+y+1, 0xFF) != 0xFF) { // pixel below is black
          xStartBelow = x;
        }
      }

      // do flood fill
      let maxAboveLimit = 0;
      if (xStartAbove != -1) {
        maxAboveLimit = Math.max(maxAboveLimit, floodFillUntil(img, xStartAbove,+y-1, limit));
      }
      if (xStartBelow != -1) maxAboveLimit = Math.max(maxAboveLimit, floodFillUntil(img, xStartAbove,+y+1, limit));

      // unable to reach limit--region is integral to the structure; remove
      if (maxAboveLimit > 0) {
        // undo removal of region
        for (let x = finalist.x; x < finalist.x + finalist.w; x++) { setPixelAt(img, x, +y, 0); }
        
        if (!(y in toDelete)) toDelete[y] = [];
        toDelete[y].push(+i);
        // finalists[y].splice(+i,1);
      }
    }
  }

  // delete those that have been marked for deletion
  for (const y in toDelete) {
    const group = toDelete[y];
    for (let i = group.length-1; i >= 0; i--) {
      finalists[y].splice(+i,1);
    }
  }

  // undo removal of all finalist regions
  for (const y in finalists) {
    for (const finalist of finalists[y]) {
      for (let x = finalist.x; x < finalist.x + finalist.w; x++) {
        setPixelAt(img, x, +y, 0); // reset to black
      }
    }
  }

  return finalists;
}

export function getPrunableRegions(
  thickGroups: GroupedPixelRegions,
  thinRegions: CategorizedPixelRegions
) {
  const dist = getSetting<number>("horizontalPrune.distance");

  // get all thin regions close_enough_to/under a thick region
  const thinRegionPruningCandidates: CategorizedPixelRegions = {}; // have thick region above
  for (const y in thickGroups) {
    for (const group of thickGroups[y]) {
      const yValues = Object.keys(group);

      const fromY = +yValues[yValues.length-1];
      const toY = +fromY + dist;
      for (const r1 of group[fromY]) {
        for (let wy = fromY+1; wy <= toY; wy++) {
          if (!(wy in thinRegions)) continue; // no categories matching this y-value
          for (const r2i in thinRegions[wy]) {
            const r2 = thinRegions[wy][r2i];
            if (doRegionsOverlap(r1,r2)) {
              if (!(wy in thinRegionPruningCandidates)) thinRegionPruningCandidates[wy] = [];
              thinRegionPruningCandidates[wy].push(r2);
              delete thinRegions[wy][r2i]; // ensure region is not used twice
            }
          }
        }
      }
    }
  }

  // get all thin regions close_enough_to/OVER a thick region
  const thinRegionPruningFinalists: CategorizedPixelRegions = {}; // have thick region above and below
  for (const y in thickGroups) {
    for (const group of thickGroups[y]) {
      const yValues = Object.keys(group);

      const toY = +yValues[0];
      const fromY = +toY - dist;
      for (const r1 of group[toY]) {
        for (let wy = fromY; wy < toY; wy++) {
          if (!(wy in thinRegionPruningCandidates)) continue; // no categories matching this y-value
          for (const r2i in thinRegionPruningCandidates[wy]) {
            const r2 = thinRegionPruningCandidates[wy][r2i];
            if (doRegionsOverlap(r1,r2)) {
              if (!(wy in thinRegionPruningFinalists)) thinRegionPruningFinalists[wy] = [];
              thinRegionPruningFinalists[wy].push(r2);
              delete thinRegionPruningCandidates[wy][r2i]; // ensure region is not used twice
            }
          }
        }
      }
    }
  }

  return thinRegionPruningFinalists;
}

export function groupRegions(regions: CategorizedPixelRegions) {
  const groups: GroupedPixelRegions = {};
  
  let lastY = 1;
  for (let y in regions) {
    if (lastY + 1 != +y) { // if not consecutive, nothing can be touching
      lastY = +y;
      continue;
    }

    groups[y] = [];

    // see if old group can have new region added in
    for (const y2 in groups) {
      for (const group of groups[y2]) {
        // console.log(lastY, group)
        if (!(lastY in group)) continue; // ignore this group, unable to connect
        for (const r1 of group[lastY]) {
          for (const r2i in regions[y]) {
            const r2 = regions[y][r2i];
            if (doRegionsOverlap(r1, r2)) {
              if (!(y in group)) group[y] = [];
              // console.log(r1.x,r2.x)
              group[y].push(r2);
              regions[y].splice(+r2i,1); // ensure this cannot be used twice
            }
          }
        }
      }
    }

    for (const region of regions[y]) {
      groups[y].push({[+y]: [region] });
    }

    // see if group can have region appended to it
    const lastRegions = regions[lastY];
    for (const r1i in regions[y]) {
      for (const r2i in lastRegions) {
        const r1 = regions[y][r1i];
        const r2 = lastRegions[r2i];
        if (doRegionsStrictlyOverlap(r1,r2)) {
          groups[y][r1i][y].push(r2);
          lastRegions.splice(+r2i,1); // ensure this cannot be used twice
        }
      }
    }
    lastY = +y;
  }

  return groups;
}

export function categorizeRegions(regions: PixelRegion[]) {
  const categorized: CategorizedPixelRegions = {};
  for (const region of regions) {
    if (!(region.y in categorized)) categorized[region.y] = [];
    categorized[region.y].push(region);
  }
  return categorized;
}

function doRegionsOverlap(r1: PixelRegion, r2: PixelRegion) {
  return (r1.x >= r2.x && r1.x <= r2.x + r2.w || r2.x >= r1.x && r2.x <= r1.x + r1.w);
}

// r2 entirely contained within r1
function doRegionsStrictlyOverlap(r1: PixelRegion, r2: PixelRegion) {
  return (r2.x >= r1.x && r2.x + r2.w <= r1.x + r1.w)
}

export function getRegions(img: Jimp) {
  const thickRegionThreshold = getSetting<number>("horizontalPrune.thick");
  const thinRegionThreshold = getSetting<number>("horizontalPrune.thin");
  
  const thickRegions: PixelRegion[] = [];
  const thinRegions: PixelRegion[] = [];

  // find thin/thick regions
  for (let y = 0; y < img.bitmap.height; y++) {
    let startX = -1;
    for (let x = 0; x < img.bitmap.width; x++) {
      const idx = 4*(x + y*img.bitmap.width);
      if (img.bitmap.data[idx] == 0) { // start new region
        if (startX != -1) continue; // region already started
        startX = x;
      }
      else { // end region
        if (startX == -1) continue; // region already ended
        const length = x - startX;
        if (length >= thickRegionThreshold) {
          thickRegions.push({
            x: startX,y,
            w: length
          });
        }
        else if (length <= thinRegionThreshold) {
          thinRegions.push({
            x: startX,y,
            w: length
          });
        }
        startX = -1;
      }
    }
  }

  return {
    thickRegions,
    thinRegions
  };
}
