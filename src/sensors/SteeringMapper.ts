export interface SteeringOptions {
  sensitivity: number;
  inverted: boolean;
  deadZone: number;
  maxAngle: number;
}

const defaults: SteeringOptions = {
  sensitivity: 1,
  inverted: false,
  deadZone: 5,
  maxAngle: 35,
};

export class SteeringMapper {
  private center = 0;
  private filtered = 0;
  private options = { ...defaults };
  private readonly smoothing = 0.22;

  setOptions(options: Partial<SteeringOptions>): void {
    this.options = { ...this.options, ...options };
  }

  calibrate(angle: number): void {
    this.center = angle;
    this.filtered = 0;
  }

  map(angle: number): number {
    let offset = angle - this.center;
    if (Math.abs(offset) <= this.options.deadZone) offset = 0;
    else offset -= Math.sign(offset) * this.options.deadZone;
    const direction = this.options.inverted ? -1 : 1;
    const target = Math.max(-1, Math.min(1, offset / (this.options.maxAngle - this.options.deadZone))) * this.options.sensitivity * direction;
    this.filtered += (Math.max(-1, Math.min(1, target)) - this.filtered) * this.smoothing;
    if (Math.abs(this.filtered) < 0.005) this.filtered = 0;
    return this.filtered;
  }

  neutral(): void {
    this.filtered = 0;
  }
}
