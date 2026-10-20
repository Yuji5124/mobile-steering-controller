export interface InputMessage {
  type: 'input';
  version: 1;
  steering: number;
  brake: boolean;
  horn: boolean;
  seq: number;
}

export function makeInput(steering: number, brake: boolean, horn: boolean, seq: number): InputMessage {
  return { type: 'input', version: 1, steering: Math.max(-1, Math.min(1, steering)), brake, horn, seq };
}
