import { makeInput } from './InputProtocol';

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private sequence = 0;
  get connected(): boolean { return this.socket?.readyState === WebSocket.OPEN; }

  connect(url: string, onState: (state: 'connected' | 'disconnected') => void): void {
    const parsed = new URL(url);
    if (parsed.protocol !== 'wss:') throw new Error('安全な接続（WSS）が必要です');
    this.close();
    const socket = new WebSocket(parsed);
    this.socket = socket;
    socket.addEventListener('open', () => onState('connected'));
    socket.addEventListener('close', () => { if (this.socket === socket) { this.socket = null; onState('disconnected'); } });
    socket.addEventListener('error', () => onState('disconnected'));
  }

  send(steering: number, brake: boolean, horn: boolean): void {
    if (!this.connected || !this.socket) return;
    this.socket.send(JSON.stringify(makeInput(steering, brake, horn, ++this.sequence)));
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
