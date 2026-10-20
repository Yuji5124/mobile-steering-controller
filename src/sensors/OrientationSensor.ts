export type SensorState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';

export class OrientationSensor {
  state: SensorState = 'idle';
  latestAngle: number | null = null;
  private listener: ((angle: number) => void) | null = null;

  async start(onAngle: (angle: number) => void): Promise<void> {
    this.listener = onAngle;
    if (!('DeviceOrientationEvent' in window)) {
      this.state = 'unsupported';
      throw new Error('この端末では姿勢センサーを利用できません');
    }
    this.state = 'requesting';
    const eventType = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> };
    try {
      if (typeof eventType.requestPermission === 'function') {
        const permission = await eventType.requestPermission();
        if (permission !== 'granted') throw new Error('センサーの利用が許可されませんでした');
      }
      window.addEventListener('deviceorientation', this.handle);
      this.state = 'ready';
    } catch (error) {
      this.state = 'denied';
      throw error;
    }
  }

  stop(): void {
    window.removeEventListener('deviceorientation', this.handle);
    this.state = 'idle';
    this.latestAngle = null;
  }

  private handle = (event: DeviceOrientationEvent): void => {
    if (event.beta === null || event.gamma === null) return;
    const screenAngle = (screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0) % 180;
    // In portrait the screen's horizontal axis follows gamma; in landscape it follows beta.
    const tilt = screenAngle === 90 ? -event.beta : event.gamma;
    this.latestAngle = tilt;
    this.listener?.(tilt);
  };
}
