import './style.css';
import { orientationRoll, smoothSteering, steeringFromTilt } from '../sensor';

type InputMessage = { type: 'input'; version: 1; steering: number; brake: boolean; horn: boolean; seq: number };
type ServerMessage = { type: 'status'; connected: boolean } | { type: 'ack'; seq: number };
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="controller"><header><span class="status"><i id="lamp"></i><b id="status">接続しています…</b></span><button class="settings" id="settings" aria-label="開発者パネル">⚙</button></header><section class="controls"><button class="action horn" id="horn" aria-label="クラクション">📣<small>クラクション</small></button><div class="wheel-area"><div class="wheel" id="wheel"><div class="wheel-ring"><i></i><b>くるくる</b><i></i></div><div class="wheel-hub">⭐</div></div><p id="tilt-hint">iPhoneを左右にかたむけてね</p></div><button class="action brake" id="brake" aria-label="ブレーキ">🛑<small>ブレーキ</small></button></section><aside class="debug-panel" id="debug-panel" aria-hidden="true"><div class="debug-head"><b>開発者用｜操舵診断</b><button id="close-debug" aria-label="閉じる">×</button></div><dl><dt>接続</dt><dd id="d-connection">—</dd><dt>画面角度</dt><dd id="d-angle">—</dd><dt>β / γ</dt><dd id="d-axes">—</dd><dt>補正後傾斜</dt><dd id="d-tilt">—</dd><dt>操舵目標 → 送信値</dt><dd id="d-steering">—</dd><dt>向き</dt><dd id="d-direction">中央</dd><dt>送信頻度</dt><dd id="d-rate">0 Hz</dd><dt>応答遅延 RTT</dt><dd id="d-rtt">—</dd></dl><label class="smooth">平滑化 <input id="smoothing" type="range" min="5" max="80" value="22"><span id="d-alpha">0.22</span></label><button id="invert" class="debug-action">操舵方向を反転</button><button id="recalibrate" class="debug-action">この姿勢を中央にする</button><p class="debug-note">値は診断用です。遅延は端末からサーバーへの往復時間です。</p></aside><div class="overlay" id="permission"><div class="card"><div class="emoji">🚗</div><h1>ハンドルをつなごう！</h1><p>傾きセンサーを使って運転するよ。iPhoneを横向きに持ってね。</p><button id="start">ハンドルをはじめる</button><button class="secondary" id="touch-mode">タッチ操作でつづける</button></div></div><div class="toast hidden" id="toast"></div></main>`;

const params = new URLSearchParams(location.search);
const host = params.get('host');
const token = params.get('token');
const status = document.querySelector<HTMLElement>('#status')!;
const lamp = document.querySelector<HTMLElement>('#lamp')!;
const wheel = document.querySelector<HTMLElement>('#wheel')!;
const permission = document.querySelector<HTMLElement>('#permission')!;
const toast = document.querySelector<HTMLElement>('#toast')!;
const debugPanel = document.querySelector<HTMLElement>('#debug-panel')!;
let socket: WebSocket | undefined;
let retryTimer = 0;
let retryDelay = 500;
let seq = 0;
let steering = 0;
let targetSteering = 0;
let filtered = 0;
let baseline: number | null = null;
let rawBeta: number | null = null;
let rawGamma: number | null = null;
let roll: number | null = null;
let brake = false;
let horn = false;
let connected = false;
let orientationEnabled = false;
let invertSteering = false;
let smoothingAlpha = 0.22;
let sentCount = 0;
let lastRateAt = performance.now();
let sentHz = 0;
let lastRtt: number | null = null;
let acknowledged = 0;
const sentAt = new Map<number, number>();

function showToast(message: string) { toast.textContent = message; toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2400); }
function setConnection(isConnected: boolean) {
  connected = isConnected;
  lamp.classList.toggle('online', isConnected); lamp.classList.toggle('offline', !isConnected);
  status.textContent = isConnected ? 'ゲームにつながったよ！' : 'ゲーム画面を待っています';
  if (!isConnected) { steering = 0; filtered = 0; brake = true; }
  else { brake = false; steering = 0; filtered = 0; }
}
function connect() {
  if (!host || !token) { status.textContent = 'QRコードから開いてね'; lamp.classList.add('offline'); return; }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const current = new WebSocket(`${protocol}//${host}/ws?role=controller&token=${encodeURIComponent(token)}`);
  socket = current;
  current.addEventListener('open', () => { retryDelay = 500; status.textContent = 'ゲームを確認しています…'; });
  current.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    if (message.type === 'status') setConnection(message.connected);
    if (message.type === 'ack') {
      const startedAt = sentAt.get(message.seq);
      if (startedAt !== undefined) lastRtt = performance.now() - startedAt;
      for (const key of sentAt.keys()) if (key <= message.seq) sentAt.delete(key);
      acknowledged++;
    }
  });
  current.addEventListener('close', event => {
    if (socket !== current) return;
    if (event.code === 4001) { setConnection(false); status.textContent = 'QRコードの期限切れ'; return; }
    if (event.code === 4002) { setConnection(false); status.textContent = '別の端末が接続しました'; return; }
    setConnection(false); status.textContent = '再接続しています…';
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 5000);
  });
  current.addEventListener('error', () => { status.textContent = '接続を確認しています…'; });
}
connect();

function screenAngle() { return Number(screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0); }
function orientationValue(event: DeviceOrientationEvent): number | null {
  return orientationRoll(event.beta, event.gamma, screenAngle());
}
function onOrientation(event: DeviceOrientationEvent) {
  rawBeta = event.beta; rawGamma = event.gamma;
  const value = orientationValue(event);
  if (value === null || !Number.isFinite(value)) return;
  roll = value;
  if (baseline === null) {
    baseline = value;
    document.querySelector('#tilt-hint')!.textContent = 'まっすぐ持つと車もまっすぐ';
    showToast('中央を記録したよ');
  }
  targetSteering = steeringFromTilt(value - baseline, invertSteering);
  filtered = smoothSteering(filtered, targetSteering, smoothingAlpha);
  steering = filtered;
  wheel.style.transform = `rotate(${steering * 65}deg)`;
}

async function startSensors() {
  const requestPermission = (DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }).requestPermission;
  try {
    if (requestPermission && await requestPermission() !== 'granted') throw new Error('センサーを許可してください');
    if (!('DeviceOrientationEvent' in window)) throw new Error('この端末では傾きセンサーが使えません');
    orientationEnabled = true; window.addEventListener('deviceorientation', onOrientation);
    setTimeout(() => { if (baseline === null) showToast('センサー値が届きません。タッチ操作も使えます'); }, 1800);
  } catch (error) { showToast(error instanceof Error ? error.message : 'センサーが使えません'); }
  permission.classList.add('hidden');
}
document.querySelector('#start')!.addEventListener('click', () => void startSensors());
document.querySelector('#touch-mode')!.addEventListener('click', () => { permission.classList.add('hidden'); document.querySelector('#tilt-hint')!.textContent = '画面を左右にスライドしてね'; });

function bindHold(button: HTMLElement, update: (value: boolean) => void) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); update(true); });
  const release = () => update(false);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
bindHold(document.querySelector('#brake')!, value => { brake = value; document.querySelector('#brake')!.classList.toggle('pressed', value); });
bindHold(document.querySelector('#horn')!, value => { horn = value; document.querySelector('#horn')!.classList.toggle('pressed', value); });
const wheelArea = document.querySelector<HTMLElement>('.wheel-area')!;
wheelArea.addEventListener('pointerdown', event => { if (!orientationEnabled || baseline === null) { wheelArea.setPointerCapture(event.pointerId); updateTouch(event.clientX); } });
wheelArea.addEventListener('pointermove', event => { if ((!orientationEnabled || baseline === null) && event.buttons) updateTouch(event.clientX); });
wheelArea.addEventListener('pointerup', () => { if (!orientationEnabled || baseline === null) { steering = 0; targetSteering = 0; wheel.style.transform = 'rotate(0deg)'; } });
function updateTouch(x: number) { const rect = wheelArea.getBoundingClientRect(); steering = Math.max(-1, Math.min(1, ((x - rect.left) / rect.width - 0.5) * 2)); targetSteering = steering; wheel.style.transform = `rotate(${steering * 65}deg)`; }

function updateDiagnostics() {
  const set = (id: string, text: string) => { document.querySelector<HTMLElement>(`#${id}`)!.textContent = text; };
  set('d-connection', connected ? '接続中' : '未接続');
  set('d-angle', `${screenAngle()}°`);
  set('d-axes', `β ${rawBeta?.toFixed(1) ?? '—'}° / γ ${rawGamma?.toFixed(1) ?? '—'}°`);
  set('d-tilt', roll === null || baseline === null ? '—' : `${(roll - baseline).toFixed(1)}°`);
  set('d-steering', `${targetSteering.toFixed(2)} → ${steering.toFixed(2)}`);
  set('d-direction', Math.abs(steering) < 0.05 ? '中央' : steering < 0 ? '左' : '右');
  set('d-rate', `${sentHz} Hz (${acknowledged} ACK)`);
  set('d-rtt', lastRtt === null ? '—' : `${lastRtt.toFixed(0)} ms`);
}
document.querySelector('#settings')!.addEventListener('click', () => {
  const open = !debugPanel.classList.contains('open'); debugPanel.classList.toggle('open', open); debugPanel.setAttribute('aria-hidden', String(!open));
});
document.querySelector('#close-debug')!.addEventListener('click', () => { debugPanel.classList.remove('open'); debugPanel.setAttribute('aria-hidden', 'true'); });
document.querySelector<HTMLInputElement>('#smoothing')!.addEventListener('input', event => {
  smoothingAlpha = Number((event.currentTarget as HTMLInputElement).value) / 100;
  document.querySelector('#d-alpha')!.textContent = smoothingAlpha.toFixed(2);
});
document.querySelector('#invert')!.addEventListener('click', event => {
  invertSteering = !invertSteering;
  (event.currentTarget as HTMLButtonElement).textContent = `操舵方向を反転: ${invertSteering ? 'ON' : 'OFF'}`;
});
document.querySelector('#recalibrate')!.addEventListener('click', () => {
  if (!orientationEnabled || roll === null) { showToast('先にセンサーを許可してね'); return; }
  baseline = roll; filtered = 0; steering = 0; targetSteering = 0; wheel.style.transform = 'rotate(0deg)'; showToast('中央を記録したよ');
});

function send() {
  if (socket?.readyState === WebSocket.OPEN && connected) {
    const currentSeq = seq++;
    const message: InputMessage = { type: 'input', version: 1, steering, brake, horn, seq: currentSeq };
    sentAt.set(currentSeq, performance.now()); sentCount++;
    if (sentAt.size > 60) sentAt.delete(sentAt.keys().next().value!);
    socket.send(JSON.stringify(message));
  }
  const now = performance.now();
  if (now - lastRateAt >= 1000) { sentHz = Math.round(sentCount * 1000 / (now - lastRateAt)); sentCount = 0; lastRateAt = now; }
}
window.setInterval(send, 1000 / 30);
window.setInterval(updateDiagnostics, 100);
