# Mobile Steering Controller

`kurukuru-drive` 用の iPhone Safari コントローラーです。傾き操舵、タッチ操作、ブレーキ、クラクション、中央キャリブレーション、操舵方向補正、平滑化、通信診断を備えています。

## 開発

```sh
npm ci
npm run dev
```

開発サーバーは `http://localhost:5174` で起動します。GitHub Pages のデモ画面は `/?demo=1` で開きます。PCでは左右矢印キー、Spaceで操舵とブレーキを試せます。

```sh
npm test
npm run typecheck
npm run build
```

## Renderで同一ホスト配信

Render構成ではゲーム側 Web Service がこのアプリを `/controller/` から配信します。ゲーム側の `scripts/render-build.sh` がこのリポジトリの指定refを取得し、`VITE_BASE_PATH=/controller/` でビルドします。通常の GitHub Pages ビルドは `/mobile-steering-controller/` をbase pathに保ち、開発時は `/` で開きます。

QRのURLにはゲームホストと短命セッショントークンが含まれます。コントローラーは同じホストの `/ws` にWSS接続し、iPhone Safariでは「ハンドルをはじめる」を押してセンサー許可を求めます。HTTPSの公開ホストがない状態では、実機確認をPASSにしないでください。

開発者用の ⚙ パネルには生の β/γ、画面角度、補正後傾斜、操舵目標/送信値、送信頻度、ACK RTTを表示します。接続が切れた場合は操舵を中立にし、ブレーキを有効にしてから指数バックオフで再接続します。

## GitHub Pages デモ

デモURL: https://yuji5124.github.io/mobile-steering-controller/?demo=1

Pagesのデプロイは `.github/workflows/pages.yml` が行います。`main` へのpushでビルド・デプロイされます。デモはセンサーと画面上の車の確認用で、ゲーム接続やセッション認証は行いません。

## 実機確認

iPhone 11 Safariでのセンサー軸、左右方向、遅延、実ゲーム接続は人間による実機確認が必要です。ゲーム画面側の手順は `kurukuru-drive` リポジトリのREADME「Phase 2.5｜iPhone 11 実機確認」を参照してください。
