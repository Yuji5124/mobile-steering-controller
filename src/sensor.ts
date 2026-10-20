export function orientationRoll(beta: number | null, gamma: number | null, angle: number): number | null {
  if (angle === 90) return beta;
  if (angle === -90 || angle === 270) return beta === null ? null : -beta;
  if (angle === 180) return gamma === null ? null : -gamma;
  return gamma;
}

export function steeringFromTilt(delta: number, invert = false): number {
  const dead = Math.abs(delta) < 5 ? 0 : Math.sign(delta) * (Math.abs(delta) - 5);
  const normalized = Math.max(-1, Math.min(1, dead / 30));
  return invert ? -normalized : normalized;
}

export function smoothSteering(previous: number, target: number, alpha: number): number {
  const amount = Math.max(0, Math.min(1, alpha));
  return previous + (target - previous) * amount;
}
