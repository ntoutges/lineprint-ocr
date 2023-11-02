const main = require("./src/main.js");
const settings = require("./src/settings.js");

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
  main.main(unnamedArgs, namedArgs);
}).catch(err => {
  console.error(err);
});