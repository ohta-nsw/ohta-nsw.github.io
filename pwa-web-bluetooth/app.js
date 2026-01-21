
const logEl = document.getElementById('log');
const btnScan = document.getElementById('btnScan');
const btnNotify = document.getElementById('btnNotify');
const btnWrite = document.getElementById('btnWrite');
const btnDisconnect = document.getElementById('btnDisconnect');
const serviceUuidInput = document.getElementById('serviceUuid');
const charUuidInput = document.getElementById('charUuid');

let device = null;
let server = null;
let service = null;
let characteristic = null;

function log(msg) {
  console.log(msg);
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

function supportsWebBluetooth() {
  return !!navigator.bluetooth;
}

async function connectAndGetCharacteristic() {
  if (!supportsWebBluetooth()) {
    throw new Error('このブラウザはWeb Bluetoothに未対応です。Chrome/Edge(デスクトップ/Android)を推奨。');
  }

  const serviceUuid = serviceUuidInput.value.trim();
  const charUuid = charUuidInput.value.trim();
  if (!serviceUuid || !charUuid) throw new Error('サービスUUIDとキャラUUIDを入力してください。');

  // 1) デバイス選択ダイアログ
  log('スキャンを開始します...');
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [serviceUuid] }],
    // もし、新しい仕様で "optionalServices" が必要な場合は適宜追加
    optionalServices: [serviceUuid] 
  });

  device.addEventListener('gattserverdisconnected', () => {
    log(`切断されました: ${device?.name || 'Unknown device'}`);
  });

  // 2) 接続
  log(`接続中: ${device.name || '(名称なし)'}`);
  server = await device.gatt.connect();

  // 3) サービス取得
  service = await server.getPrimaryService(serviceUuid);

  // 4) キャラクタリスティック取得
  characteristic = await service.getCharacteristic(charUuid);

  log(`接続完了: ${device.name || '(名称なし)'} / サービス: ${serviceUuid} / キャラ: ${charUuid}`);
  return characteristic;
}

btnScan.addEventListener('click', async () => {
  try {
    const ch = await connectAndGetCharacteristic();

    // 例: 読み取り（Battery Levelなど）
    const value = await ch.readValue();
    // DataView → 数値化
    const battery = value.getUint8(0);
    log(`読み取り値: ${battery} (例: Battery Levelなら %)`);
  } catch (e) {
    log('エラー: ' + (e?.message || e));
  }
});

btnNotify.addEventListener('click', async () => {
  try {
    if (!characteristic) {
      await connectAndGetCharacteristic();
    }

    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const dv = event.target.value;
      // ここは用途に応じてパース
      const v = dv.getUint8(0);
      log(`通知: ${v}`);
    });
    log('通知を購読開始しました。');
  } catch (e) {
    log('エラー: ' + (e?.message || e));
  }
});

btnWrite.addEventListener('click', async () => {
  try {
    if (!characteristic) {
      await connectAndGetCharacteristic();
    }
    // 例: 1バイト 0x01 を書き込む。用途に応じて編集
    const data = new Uint8Array([0x01]);
    await characteristic.writeValue(data);
    log('0x01 を書き込みました。');
  } catch (e) {
    log('エラー: ' + (e?.message || e));
  }
});

btnDisconnect.addEventListener('click', () => {
  try {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
      log('手動で切断しました。');
    } else {
      log('すでに未接続です。');
    }
  } catch (e) {
    log('エラー: ' + (e?.message || e));
  }
});
