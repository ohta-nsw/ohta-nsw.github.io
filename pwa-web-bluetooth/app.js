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
  return 'bluetooth' in navigator;
}

// UUIDを正規化する関数
function normalizeUuid(uuid) {
  uuid = uuid.trim();
  
  // 0x180F のような形式を処理
  if (uuid.startsWith('0x') || uuid.startsWith('0X')) {
    const hex = uuid.substring(2);
    // 16bit UUID を 128bit に変換
    if (hex.length <= 4) {
      return `0000${hex.padStart(4, '0')}-0000-1000-8000-00805f9b34fb`.toLowerCase();
    }
  }
  
  // すでに128bit形式ならそのまま
  if (uuid.includes('-')) {
    return uuid.toLowerCase();
  }
  
  // 数値として扱う場合
  if (/^[0-9]+$/.test(uuid)) {
    const hex = parseInt(uuid).toString(16).padStart(4, '0');
    return `0000${hex}-0000-1000-8000-00805f9b34fb`.toLowerCase();
  }
  
  return uuid.toLowerCase();
}

async function connectAndGetCharacteristic() {
  if (!supportsWebBluetooth()) {
    throw new Error('このブラウザはWeb Bluetoothに未対応です。Chrome/Edge(デスクトップ/Android)を推奨。');
  }

  const serviceUuid = normalizeUuid(serviceUuidInput.value);
  const charUuid = normalizeUuid(charUuidInput.value);
  
  if (!serviceUuid || !charUuid) {
    throw new Error('サービスUUIDとキャラUUIDを入力してください。');
  }

  log(`正規化されたUUID - サービス: ${serviceUuid}, キャラ: ${charUuid}`);

  try {
    // 1) デバイス選択ダイアログ
    log('スキャンを開始します...');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [serviceUuid] }]
      // optionalServicesは通常不要（filtersで指定したサービスは自動的にアクセス可能）
    });

    log(`デバイスを選択しました: ${device.name || '(名称なし)'}`);

    device.addEventListener('gattserverdisconnected', () => {
      log(`切断されました: ${device?.name || 'Unknown device'}`);
      server = null;
      service = null;
      characteristic = null;
    });

    // 2) 接続
    log(`接続中...`);
    server = await device.gatt.connect();
    log(`GATTサーバーに接続しました`);

    // 3) サービス取得
    log(`サービスを取得中...`);
    service = await server.getPrimaryService(serviceUuid);
    log(`サービスを取得しました`);

    // 4) キャラクタリスティック取得
    log(`キャラクタリスティックを取得中...`);
    characteristic = await service.getCharacteristic(charUuid);
    log(`キャラクタリスティックを取得しました`);

    log(`接続完了: ${device.name || '(名称なし)'}`);
    return characteristic;
  } catch (error) {
    log(`詳細エラー: ${error.name} - ${error.message}`);
    throw error;
  }
}

btnScan.addEventListener('click', async () => {
  try {
    const ch = await connectAndGetCharacteristic();

    // プロパティの確認
    log(`プロパティ: read=${ch.properties.read}, write=${ch.properties.write}, notify=${ch.properties.notify}`);

    // 読み取り可能かチェック
    if (ch.properties.read) {
      const value = await ch.readValue();
      const battery = value.getUint8(0);
      log(`読み取り値: ${battery} (例: Battery Levelなら ${battery}%)`);
    } else {
      log('このキャラクタリスティックは読み取り不可です');
    }
  } catch (e) {
    log('エラー: ' + (e?.message || e));
    console.error(e);
  }
});

btnNotify.addEventListener('click', async () => {
  try {
    if (!characteristic) {
      await connectAndGetCharacteristic();
    }

    if (!characteristic.properties.notify && !characteristic.properties.indicate) {
      log('このキャラクタリスティックは通知/インジケート非対応です');
      return;
    }

    await characteristic.startNotifications();
    
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const dv = event.target.value;
      const v = dv.getUint8(0);
      log(`通知: ${v}`);
    });
    
    log('通知を購読開始しました。');
  } catch (e) {
    log('エラー: ' + (e?.message || e));
    console.error(e);
  }
});

btnWrite.addEventListener('click', async () => {
  try {
    if (!characteristic) {
      await connectAndGetCharacteristic();
    }

    if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
      log('このキャラクタリスティックは書き込み不可です');
      return;
    }

    // 例: 1バイト 0x01 を書き込む
    const data = new Uint8Array([0x01]);
    await characteristic.writeValue(data);
    log('0x01 を書き込みました。');
  } catch (e) {
    log('エラー: ' + (e?.message || e));
    console.error(e);
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
    console.error(e);
  }
});
