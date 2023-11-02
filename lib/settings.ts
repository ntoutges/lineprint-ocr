const fs = require("fs");

var settings: Record<string,any> = null;

export function init() {
  return new Promise<string>((resolve,reject) => {
    try {
      settings = JSON.parse(
        fs.readFileSync(__dirname + "/../settings.json").toString().replace(/(\/\*.+\*\/)|(\/\/[^\n]*\n)/gs, "") // gets rid of comments
      );
      resolve("");
    }
    catch(err) { reject(err.toString()); }
  });
}

export function getSetting<T>(keyStr: string, fallback: any = undefined): T {
  const keyArr = keyStr.split(".");
  let head = settings;
  for (const key of keyArr) {
    if (head == null || typeof head != "object") return fallback;
    if (!(key in head)) return fallback;
    head = head[key];
  }
  return head as T;
}