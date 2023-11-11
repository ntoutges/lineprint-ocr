import Jimp = require("jimp");
import { isStake, leftFlatness0 } from "./featureable.js";
import { TokenText } from "./postprocessable.js";
import { shift } from "./jimpable.js";
import { getImageDifference, refImages } from "./trainable.js";
import { Bounds } from "./floodable.js";

// functions mutate original input
export const steps: Record<string, (input: TokenText, settings: Record<string,any>) => void> = {
  "; Correction": correctSemicolon,
  ": Correction": correctColon,
  "- Correction": correctDash,
  "B/8 Correction": correctBandEight,
  "B/8 Replacement": replaceBandEight,
  "Garbage Removal": garbageRemoval,
  "Gradient Decent": gradientDecent,
  "Dollar-Sign Disambiguation": dollarSignDisambiguation
};

// user defined functinos for application-specific tasks

function correctSemicolon(input: TokenText, settings: Record<string,any>) {
  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 1; x < line.length; x++) {

      // consider converting ":"/")" -> ";"
      const isReplaceable = line[x] == ":" || line[x] == ")";
      if (isReplaceable && line[x-1] == " ") { // previous character is empty, and current character is a colon
        const distance = input.getToken(y, x).distances[";"];
        input.setChar(y, x, ";");
      }
    }
  }
}

function correctColon(input: TokenText, settings: Record<string,any>) {
  const minRatio = settings["min-ratio"] as number;
  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 1; x < line.length; x++) {
      
      // consider converting ";" -> ":"
      if (line[x] == ";" && line[x-1] != " ") { // previous character is not empty, and current character is a semicolon
        const distance = input.getToken(y, x).distances[":"];
        if (distance < minRatio) input.setChar(y, x, ":");
      }
    }
  }
}

function correctDash(input: TokenText, settings: Record<string,any>) {
  const minRatio = settings["min-ratio"] as number;
  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 1; x < line.length; x++) {
      
      // consider converting "^" -> "-"
      if (line[x] == "^" && line[x-1] == ";") { // previous character is a semicolon, and current character is a caret
        input.setChar(y, x, "-");
      }
    }
  }
}

// notoriously hard to tell apart
function correctBandEight(input: TokenText, settings: Record<string,any>) { // this... kind of works?
  // const minRatio = settings["min-ratio"] as number;
  const flatnessSmoothing = settings["flatness-smoothing"] as number;
  const threshold = settings["threshold"] as number;
  const topBottomBuffer = settings["top-bottom-buffer"] as number;
  
  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 0; x < line.length; x++) {
      if (line[x] != "8" && line[x] != "B") continue;

      const currentWord = getWord(line, x);
      const distance = leftFlatness0(input.getToken(y,x).img, flatnessSmoothing, topBottomBuffer);
      
      if (distance >= threshold) input.setChar(y,x, "8");
      else input.setChar(y,x,"B");
    }
  }
}

function getWord(text: string, index: number) {
  let minX = index;
  let maxX = index;
  
  // find start of word
  for (let i = index-1; i >= 0; i--) {
    if (text[i] == " ") { // end of word
      minX = i+1;
      break;
    }
    if (i == 0) minX = 0;
  }

  // find end of word
  for (let i = index+1; i < text.length; i++) {
    if (text[i] == " ") { // end of word
      maxX = i;
      break;
    }
    if (i == text.length-1) maxX = i+1;
  }
  return text.substring(minX, maxX);
}

const hexablePattern = /^(0x)?[\dabcdef]+$/i;
function isHexable(text: string) {
  return !!text.match(hexablePattern);
}

function replaceBandEight(input: TokenText, settings: Record<string,any>) {
  let replaceB = (settings["b-replacement-char"] as string);
  let replace8 = (settings["8-replacement-char"] as string);

  if (replaceB != null) replaceB = replaceB[0];
  if (replace8 != null) replace8 = replace8[0];
  
  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 0; x < line.length; x++) {
      if (line[x] == "8") input.setChar(y,x, replace8);
      else if (line[x] == "B") input.setChar(y,x, replaceB);
    }
  }
}

function garbageRemoval(input: TokenText, settings: Record<string,any>) {
  const threshold = settings.threshold as number;
  const replacement = settings.removalChar[0] as string;
  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 0; x < line.length; x++) {
      if (input.getToken(y,x).adistance > threshold) input.setChar(y,x, replacement);
    }
  }
}

// subtly move character, and try to find a better match
function gradientDecent(input: TokenText, settings: Record<string,any>) {
  const whitelist = new Set<string>(settings.whitelist.split(""));
  const maxDiff = settings["max-difference"] as number;

  const moveUp = settings.step.up as number;
  const moveDown = settings.step.down as number;
  const moveLeft = settings.step.left as number;
  const moveRight = settings.step.right as number;

  const maxSteps = settings["max-steps"] as number;
  const stepDivisor = settings["step-divisor"] as number;

  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (!whitelist.has(char)) continue; // char cannot be gradient-ascented
      const token = input.getToken(y,x);
      
      let minDist: number = token.adistance;
      let minChar: string = token.value;
      for (const possibleChar in token.distances) {
        if (token.distances[possibleChar] > maxDiff) continue; // too different

        // get direction to move in
        const [minScore, bestX, bestY] = getBestDirection(token.img, possibleChar, moveUp, moveDown, moveLeft, moveRight);
        let dirX = bestX;
        let dirY = bestY;
        if (minScore < minDist) {
          minDist = minScore;
          minChar = possibleChar;
        }

        // continue moving in that direction
        let lastDist = minScore;
        let offX = dirX;
        let offY = dirY;
        for (let i = 0; i <= maxSteps; i++) {
          const score = getScoreInDirection(token.img, possibleChar, offX + dirX, offY + dirY);
          
          if (score > lastDist) {
            dirX = Math.floor(dirX / stepDivisor);
            dirY = Math.floor(dirY / stepDivisor);
            if (dirX == 0 && dirY == 0) break; // dividing will make this unusable; give up
          }
          else { // "save" new position
            offX += dirX;
            offY += dirY;
            lastDist = score;
          }
          
          if (score < minDist) {
            minDist = score;
            minChar = possibleChar;
          }
        }
      }

      if (minChar != token.value) {
        process.stdout.write(`  [${y+1},${x}: \x1b[36m${token.value}\x1b[0m -> \x1b[36m${minChar}\x1b[0m]`);
        input.setChar(y,x, minChar);
        for (const char in token.distances) {
          token.distances[char] = token.distances[char] * token.adistance / minDist; // now a ratio of new min distance
        }
        token.adistance = minDist;
      }
    }
  }
  console.log(""); // new line
}

function getBestDirection(
  img: Jimp,
  char: string,
  upStep: number,
  downStep: number,
  leftStep: number,
  rightStep: number
): [minScore:number, minX:number, minY:number] {
  let minScore = Infinity;
  let minX = 0;
  let minY = 0;
  if (upStep > 0) {
    const score = getScoreInDirection(img,char, 0,-upStep);
    if (score < minScore) {
      minScore = score;
      minY = -upStep;
      minX = 0;
    }
  }
  if (downStep > 0) {
    const score = getScoreInDirection(img,char, 0,downStep);
    if (score < minScore) {
      minScore = score;
      minY = downStep;
      minX = 0;
    }
  }
  if (leftStep > 0) {
    const score = getScoreInDirection(img,char, -leftStep,0);
    if (score < minScore) {
      minScore = score;
      minY = 0;
      minX = -leftStep;
    }
  }
  if (rightStep > 0) {
    const score = getScoreInDirection(img,char, rightStep,0);
    if (score < minScore) {
      minScore = score;
      minY = 0;
      minX = rightStep;
    }
  }

  return [minScore, minX, minY];
}

function getScoreInDirection(
  img: Jimp,
  char: string,
  xOff: number,
  yOff: number
) {
  const shiftedImg = shift(img, xOff,yOff);
  return getImageDifference(
    shiftedImg,
    refImages[char]
  );
}

// take S/$, and see if it has the featurs on the top/bottom marking it as a $ (expand character to better find these)
function dollarSignDisambiguation(input: TokenText, settings: Record<string,any>) {
  const maxWidthRatio = settings.limits["max-width-ratio"] as number;
  const minWidthRatio = settings.limits["min-width-ratio"] as number;

  const minStakeWidthRatio = settings.stake["width-ratio"] as number;
  const minStakeHeightRatio = settings.stake["height-ratio"] as number;

  const requireBothStakes = settings.requireBothStakes as boolean;

  for (let y = 0; y < input.length; y++) {
    const line = input.getText(y);
    for (let x = 0; x < line.length; x++) {
      if (line[x] != "S" && line[x] != "$") continue; // ignore, not "S" or "$"
      
      const token = input.getToken(y,x);
      const minWidth = Math.round(minWidthRatio * token.bounds.w);
      const maxWidth = Math.round(maxWidthRatio * token.bounds.w);

      // expand upwards until too wide, or not wide enough
      const minY = expandYUntil(
        input.img,
        token.bounds.x,
        token.bounds.y,
        token.bounds.w,
        -1, minWidth, maxWidth
      );

      // expand downwards until too wid, or not wide enough
      const maxY = expandYUntil(
        input.img,
        token.bounds.x,
        token.bounds.y2,
        token.bounds.w,
        1, minWidth, maxWidth
      );

      token.bounds.y = minY;
      token.bounds.y2 = maxY;
      token.bounds.h = maxY - minY;

      const cX = token.bounds.x + Math.round(token.bounds.w / 2);
      
      const minStakeWidth = Math.round(minStakeWidthRatio * token.bounds.w);
      const minStakeHeight = Math.round(minStakeHeightRatio * token.bounds.h);

      let stakeCount = 0;
      
      // check if top-stake exists
      stakeCount += +isStake(
        input.img,
        cX,token.bounds.y,
        token.bounds,
        1,
        minStakeWidth,
        minStakeHeight
      );

      // check if bottom-stake exists
      stakeCount += +isStake(
        input.img,
        cX,token.bounds.y2,
        token.bounds,
        -1,
        minStakeWidth,
        minStakeHeight
      );

      const isDollarSign = stakeCount == 2 || (stakeCount == 1 && !requireBothStakes);
      
      if ((isDollarSign) == (line[x] == "$")) continue; // no difference, no point
      if (isDollarSign) input.setChar(y,x, "$");
      else input.setChar(y,x, "S");
    }
  }
}

function expandYUntil(
  img: Jimp,
  x: number,
  y: number,
  width: number,
  step: number,
  minWidth: number,
  maxWidth: number
) {
  const extremeY = (step < 0) ? -1 : img.bitmap.height;
  let lastTotal = -1;

  for (let y2 = y+step; y2 != extremeY; y2 += step) {
    let total = 0;
    img.scan(x,y2, width,1, (_x,_y,idx) => {
      if (img.bitmap.data[idx] != 0xFF) total++; 
    });

    if (lastTotal == -1) lastTotal = total;
    
    // out of bounds
    if (total <= minWidth || (total > maxWidth && total > lastTotal)) return y2 - step;

    lastTotal = total;
  }
  return extremeY - step;
}
