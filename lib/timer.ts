let start = 0;

export function startTimer() {
  start = (new Date()).getTime();
}

export function checkTime() {
  const now = (new Date()).getTime();
  return now - start;
}

export function lap() {
  const now = (new Date()).getTime();
  const diff = now - start;
  start = now;
  return diff;
}