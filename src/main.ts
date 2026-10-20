import './styles.css';
import { OrientationSensor } from './sensors/OrientationSensor';
import { SteeringMapper } from './sensors/SteeringMapper';
import { WebSocketClient } from './controller/WebSocketClient';

const app = document.querySelector<HTMLElement>('#app')!;
const sensor = new OrientationSensor();
const mapper = new SteeringMapper();
const socket = new WebSocketClient();
const params = new URLSearchParams(location.search);
const demoMode = location.pathname === '/demo' || params.has('demo');
const socketUrl = params.get('ws');
let steering = 0;
let brake = false;
let horn = false;
let enabled = false;
let calibrated = false;
let seqTimer = 0;
let sensitivity = Number(localStorage.getItem('sensitivity') || 1);
let inverted = localStorage.getItem('inverted') === 'true';
const statusText = socketUrl ? '接続待機中' : 'ゲームを待っています';

app.innerHTML = `
<section class="scene">
  <div class="sun"></div><div class="hill left"></div><div class="hill right"></div><div class="tree one">🌳</div><div class="tree two">🌲</div><div class="road"></div>
  <div class="status" id="status"><i class="dot"></i><span>${statusText}</span></div>
  <button class="settings" id="settings" aria-label="設定">⚙</button>
  <div class="controls">
    <button class="big-button horn" id="horn" aria-label="クラクション">📣</button>
    <div class="wheel-wrap"><div class="wheel" id="wheel"><div class="wheel-ring"></div><div class="wheel-spoke left"></div><div class="wheel-spoke right"></div><div class="wheel-spoke bottom"></div><div class="hub">🚗</div></div></div>
    <button class="big-button brake" id="brake" aria-label="ブレーキ">🦶</button>
  </div>
  <div id="overlay"></div><div class="diag" id="diag" hidden></div>
</section>`;

const status = document.querySelector<HTMLElement>('#status')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;
const wheel = document.querySelector<HTMLElement>('#wheel')!;
const diag = document.querySelector<HTMLElement>('#diag')!;

function setStatus(label: string, kind = ''): void {
  status.querySelector('span')!.textContent = label;
  status.className = `status ${kind}`;
}
function send(): void { socket.send(steering, brake, horn); }
function updateWheel(angle: number): void {
  wheel.style.transform = `rotate(${angle * 120}deg)`;
  if (diag.hidden === false) diag.textContent = `tilt ${sensor.latestAngle?.toFixed(1) ?? '—'}° · steer ${steering.toFixed(2)}`;
}
function openSettings(): void {
  overlay.innerHTML = `<div class="modal"><div class="settings-card"><h2>おとなの設定</h2>
  <label>ハンドルの感度　<span id="sensitivityValue">${sensitivity.toFixed(1)}×</span><input id="sensitivity" type="range" min="0.5" max="1.8" step="0.1" value="${sensitivity}"></label>
  <label><input id="inverted" type="checkbox" ${inverted ? 'checked' : ''}> ハンドルの向きを反転</label>
  <label><input id="diagnostic" type="checkbox"> センサー診断を表示</label>
  <div class="setting-actions"><button id="calibrate">まんなかに戻す</button><button id="closeSettings">とじる</button></div></div></div>`;
  overlay.querySelector<HTMLInputElement>('#sensitivity')!.oninput = (event) => {
    sensitivity = Number((event.currentTarget as HTMLInputElement).value);
    overlay.querySelector<HTMLElement>('#sensitivityValue')!.textContent = `${sensitivity.toFixed(1)}×`;
    localStorage.setItem('sensitivity', String(sensitivity)); mapper.setOptions({ sensitivity });
  };
  overlay.querySelector<HTMLInputElement>('#inverted')!.onchange = (event) => { inverted = (event.currentTarget as HTMLInputElement).checked; localStorage.setItem('inverted', String(inverted)); mapper.setOptions({ inverted }); };
  overlay.querySelector<HTMLInputElement>('#diagnostic')!.onchange = (event) => { diag.hidden = !(event.currentTarget as HTMLInputElement).checked; };
  overlay.querySelector<HTMLButtonElement>('#calibrate')!.onclick = calibrate;
  overlay.querySelector<HTMLButtonElement>('#closeSettings')!.onclick = () => { overlay.innerHTML = ''; };
}
function calibrate(): void {
  if (sensor.latestAngle === null) { setStatus('先にハンドルをつないでね', ''); return; }
  mapper.calibrate(sensor.latestAngle); calibrated = true; steering = 0; updateWheel(0); send();
}

mapper.setOptions({ sensitivity, inverted });
document.querySelector('#settings')!.addEventListener('click', openSettings);
function pressButton(id: string, set: (value: boolean) => void): void {
  const button = document.getElementById(id)!;
  const down = (event: PointerEvent) => { event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add('pressed'); set(true); send(); };
  const up = () => { button.classList.remove('pressed'); set(false); send(); };
  button.addEventListener('pointerdown', down);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, up);
}
pressButton('horn', value => { horn = value; });
pressButton('brake', value => { brake = value; });

async function start(): Promise<void> {
  try {
    await sensor.start((angle) => {
      if (!calibrated) {
        mapper.calibrate(angle);
        calibrated = true;
        steering = 0;
        updateWheel(0);
      } else {
        steering = mapper.map(angle);
        updateWheel(steering);
      }
    });
    if (socketUrl) {
      socket.connect(socketUrl, (state) => setStatus(state === 'connected' ? 'ゲームにつながったよ' : '接続が切れました', state === 'connected' ? 'connected' : 'disconnected'));
    } else {
      setStatus('ハンドル OK', 'connected');
    }
    enabled = true;
    document.querySelector('#startOverlay')?.remove();
    seqTimer = window.setInterval(() => { if (enabled) send(); }, 1000 / 30);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'センサーを使えません', 'disconnected');
  }
}

if (!params.has('ws')) {
  overlay.innerHTML = `<div class="connect-screen" id="startOverlay"><div class="connect-card"><h1>ハンドルをつなごう！</h1><p>iPhoneを横向きにして、ゆっくり持ってね</p><button class="primary" id="startButton">ハンドルをつなぐ</button><p class="hint">タップするとセンサーを使います</p></div></div>`;
  document.querySelector('#startButton')!.addEventListener('click', start);
} else {
  overlay.innerHTML = `<div class="connect-screen" id="startOverlay"><div class="connect-card"><h1>ハンドルをつなごう！</h1><p>ゲームと接続する前に、センサーを許可してね</p><button class="primary" id="startButton">ハンドルをつなぐ</button></div></div>`;
  document.querySelector('#startButton')!.addEventListener('click', start);
}

if (demoMode) {
  overlay.innerHTML = `<div class="demo-screen"><div class="demo-road"><div class="demo-lane"></div></div><div class="demo-label">開発デモ · iPhoneを傾けてね</div><div class="demo-readout" id="demoReadout">操舵 0.00 · 準備中</div><div class="demo-car" id="demoCar">🏎️</div><div class="connect-screen" id="startOverlay"><div class="connect-card"><h1>開発デモ</h1><p>センサーを使うには、タップして許可してください</p><button class="primary" id="startButton">デモをはじめる</button></div></div></div>`;
  diag.hidden = true;
  document.querySelector<HTMLElement>('#settings')!.hidden = true;
  document.querySelector<HTMLElement>('#horn')!.hidden = true;
  document.querySelector<HTMLElement>('#brake')!.hidden = true;
  // Demo can be driven from desktop keyboard while the sensor is unavailable.
  window.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft') steering = Math.max(-1, steering - 0.1); if (event.key === 'ArrowRight') steering = Math.min(1, steering + 0.1); if (event.key === ' ') brake = true; });
  window.addEventListener('keyup', (event) => { if (event.key === ' ') brake = false; });
  window.setInterval(() => {
    const car = document.querySelector<HTMLElement>('#demoCar');
    const readout = document.querySelector<HTMLElement>('#demoReadout');
    if (car) car.style.transform = `translateX(${steering * 24}vw) scale(${brake ? 0.96 : 1})`;
    if (readout) readout.textContent = `操舵 ${steering.toFixed(2)} · ${brake ? '停止' : horn ? 'クラクション' : '走行中'}`;
  }, 80);
  document.querySelector('#startButton')!.addEventListener('click', start);
}

window.addEventListener('pagehide', () => {
  enabled = false; window.clearInterval(seqTimer); sensor.stop(); socket.close(); mapper.neutral();
});
