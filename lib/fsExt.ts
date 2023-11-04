const fs = require("fs");

export function getAllFiles(validTypes: string[]): string[] {
  const validSet = new Set<string>(validTypes);
  const filenames = fs.readdirSync(__dirname + "/../io/input");
  
  const validFileNames: string[] = [];
  for (const filename of filenames) {
    if (validSet.has(getExt(filename))) {
      validFileNames.push(filename);
    }
  }
  return validFileNames;
}

function getExt(filename: string) {
  const i = filename.lastIndexOf(".");
  if (i == -1) return "txt"; // implicit
  return filename.substring(i+1);
}

export function setExt(filename: string, ext: string) {
  const i = filename.lastIndexOf(".");
  if (i == -1) return filename + "." + ext; // no extension
  return filename.substring(0,i) + "." + ext;
}

export function extensionless(filename: string) {
  const i = filename.lastIndexOf(".");
  if (i == -1) return filename; // implicit
  return filename.substring(0,i);
}

export function appendToName(filename: string, append: string) {
  const i = filename.lastIndexOf(".");
  if (i == -1) return filename + append; // no extension
  return filename.substring(0,i) + append + filename.substring(i); // squish append between name of file and extension
}

export function toAbsoluteInput(filename: string) {
  return __dirname + "/../io/input/" + filename;
}

export function toAbsoluteOutput(filename: string) {
  return __dirname + "/../io/output/" + filename;
}