const Jimp = require("jimp");
const { isStake } = require("./src/featureable.js");
const main = require("./src/main.js");
const settings = require("./src/settings.js");
const training = require("./src/trainable.js");

const args = process.argv.slice(2);

// get named arguments, and separate from the rest
function separateArgs(args) {
  const namedArgs = {};
  const unnamedArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i][0] == "-") {
      if (args.length == i-1) throw new Error(`named parameter "${args[i]}" has no value`);
      namedArgs[args[i].substring(1)] = args[i+1];
      i++;
    }
    else unnamedArgs.push(args[i]);
  }
  return {
    namedArgs,
    unnamedArgs
  };
}

const { unnamedArgs, namedArgs } = separateArgs(args);

settings.init().then(() => {
  training.init().then(() => {
    switch (unnamedArgs[0]) {
      case "stake":
        testStake(unnamedArgs[1]);
        break;
      case "infinimage":
        makeBigImg(+unnamedArgs[1]);
        break;
      default:
        console.log(`Unrecognized test "${unnamedArgs[0]}"`);
    }
  });
}).catch(err => {
  console.error(err);
});

function testStake(name) {
  const minStakeWidthRatio = settings.getSetting("postprocessing.settings.Dollar-Sign Disambiguation.stake.width-ratio");
  const minStakeHeightRatio = settings.getSetting("postprocessing.settings.Dollar-Sign Disambiguation.stake.height-ratio");

  Jimp.read(__dirname + "/io/input/" + name, (err, img) => {
    const minStakeWidth = Math.round(minStakeWidthRatio * img.bitmap.width);
    const minStakeHeight = Math.round(minStakeHeightRatio * img.bitmap.height);
    
    const bounds = {
      x:0,y:0,
      x2: img.bitmap.width,
      y2: img.bitmap.height,
      w: img.bitmap.width,
      h: img.bitmap.height
    };

    const cX = Math.round(img.bitmap.width / 2);
    
    let val = 0;
    val += isStake( // check top
      img,
      cX,0,
      bounds,
      1,
      minStakeWidth,
      minStakeHeight
    );

    val += 2*isStake( // bottom
      img,
      cX,bounds.y2-1,
      bounds,
      -1,
      minStakeWidth,
      minStakeHeight
    );

    console.log(`stake count: ${val}`)
  });
}

// note: shows JIMP automatically truncates binary values to be in range 0-255
function makeBigImg(val) {
  const img = new Jimp(10,10, "white");
  img.scan(0,0, 10,10, (x,y, idx) => {
    img.bitmap.data[idx+0] = val;
    img.bitmap.data[idx+1] = val;
    img.bitmap.data[idx+2] = val;
  });

  console.log(img.bitmap.data[0]);
}