// Modbus TCP Server Configuration - Değişkenler sayfanın en üstünde
const SLAVE_ID = 1;
const PORT = 502;

const modbus = require("jsmodbus");
const net = require("net");

// Buffer boyutları (1000 register = 2000 byte, her register 2 byte)
const HOLDING_REGISTER_SIZE = 2000; // 1000 register için
const INPUT_REGISTER_SIZE = 2000;
const COIL_SIZE = 1000; // 1000 coil için (byte cinsinden)
const DISCRETE_INPUT_SIZE = 1000;

// Buffer'ları kendimiz oluştur ve yönet (0 ile doldurulmuş)
const holdingBuffer = Buffer.alloc(HOLDING_REGISTER_SIZE, 0);
const inputBuffer = Buffer.alloc(INPUT_REGISTER_SIZE, 0);
const coilBuffer = Buffer.alloc(COIL_SIZE, 0);
const discreteBuffer = Buffer.alloc(DISCRETE_INPUT_SIZE, 0);

// Modbus TCP Server oluştur
const tcpServer = new net.Server();
const modbusServer = new modbus.server.TCP(tcpServer, {
    holding: holdingBuffer,
    input: inputBuffer,
    coil: coilBuffer,
    discrete: discreteBuffer
});

// State tracking için değişkenler
let coilToggleState = Buffer.alloc(101); // 0-100 için toggle state
let discreteInputToggleState = Buffer.alloc(101); // 0-100 için toggle state
let holdingRegisterValues = {
    int16: -16000,      // 0-100 aralığı için
    uint16: 1,          // 101-200 aralığı için
    int32: -10000,      // 201-300 aralığı için
    uint32: 0,          // 301-400 aralığı için
    float16: -10000.0,  // 401-500 aralığı için
    float32: 0.0,       // 501-600 aralığı için
    float64: 0.0,       // 601-700 aralığı için
    double: 0.0         // 701-800 aralığı için
};

// Client tarafından yazılan adresleri takip et (otomatik güncellemeyi engellemek için)
const clientWrittenHoldingRegisters = new Set(); // Holding register adresleri
const clientWrittenCoils = new Set(); // Coil adresleri
const clientWrittenInputRegisters = new Set(); // Input register adresleri (opsiyonel)
const clientWrittenDiscreteInputs = new Set(); // Discrete input adresleri (opsiyonel)

// Dokümandaki başlangıç değerleri (limit aşımı olduğunda buraya reset edilir)
const START_VALUES = {
    int16: -16000,
    uint16: 1,
    int32: -10000,
    uint32: 0,
    float16: -10000.0,
    float32: 0.0,
    float64: 0.0,
    double: 0.0
};

// Type limitleri
const LIMITS = {
    int16: { min: -32768, max: 32767 },
    uint16: { min: 0, max: 65535 },
    int32: { min: -2147483648, max: 2147483647 },
    uint32: { min: 0, max: 4294967295 }
};

// Helper fonksiyonlar
function writeInt16(buffer, offset, value) {
    buffer.writeInt16BE(value, offset);
}

function writeUInt16(buffer, offset, value) {
    buffer.writeUInt16BE(value, offset);
}

function writeInt32(buffer, offset, value) {
    buffer.writeInt32BE(value, offset);
}

function writeUInt32(buffer, offset, value) {
    buffer.writeUInt32BE(value, offset);
}

function writeFloat32(buffer, offset, value) {
    buffer.writeFloatBE(value, offset);
}

function writeFloat64(buffer, offset, value) {
    buffer.writeDoubleBE(value, offset);
}

function writeString(buffer, offset, str) {
    const strBuffer = Buffer.from(str, 'utf8');
    strBuffer.copy(buffer, offset);
    // Kalan byte'ları 0 ile doldur
    for (let i = strBuffer.length; i < buffer.length - offset; i++) {
        buffer[offset + i] = 0;
    }
}

// Holding Register'ları başlangıç değerleriyle doldur
function initializeHoldingRegisters() {
    const holding = holdingBuffer;
    
    // 0-100: int16, -16000'den başla
    for (let i = 0; i <= 100; i++) {
        writeInt16(holding, i * 2, -16000 + i);
    }
    
    // 101-200: uint16, 1'den başla
    for (let i = 101; i <= 200; i++) {
        writeUInt16(holding, i * 2, 1 + (i - 101));
    }
    
    // 201-300: int32 (2 register), -10000'den başla
    // Her 2 register bir int32 değeri (toplam 50 değer)
    for (let reg = 201; reg <= 300; reg += 2) {
        const valueIndex = Math.floor((reg - 201) / 2);
        const value = -10000 + valueIndex;
        writeInt32(holding, reg * 2, value);
    }
    
    // 301-400: uint32 (2 register), 0'dan başla
    // Her 2 register bir uint32 değeri (toplam 50 değer)
    for (let reg = 301; reg <= 400; reg += 2) {
        const valueIndex = Math.floor((reg - 301) / 2);
        const value = valueIndex;
        writeUInt32(holding, reg * 2, value);
    }
    
    // 401-500: float32 (2 register), -10000.0'den başla
    // Not: float16 Modbus'ta standart değil, float32 kullanıyoruz
    // Her 2 register bir float32 değeri (toplam 50 değer)
    for (let reg = 401; reg <= 500; reg += 2) {
        const valueIndex = Math.floor((reg - 401) / 2);
        const value = -10000.0 + valueIndex * 0.111;
        writeFloat32(holding, reg * 2, value);
    }
    
    // 501-600: float32 (2 register), 0'dan başla
    // Her 2 register bir float32 değeri (toplam 50 değer)
    for (let reg = 501; reg <= 600; reg += 2) {
        const valueIndex = Math.floor((reg - 501) / 2);
        const value = valueIndex * 0.222;
        writeFloat32(holding, reg * 2, value);
    }
    
    // 601-700: float64 (4 register), 0'dan başla
    // Her 4 register bir float64 değeri (toplam 25 değer)
    for (let reg = 601; reg <= 700; reg += 4) {
        const valueIndex = Math.floor((reg - 601) / 4);
        const value = valueIndex * 0.333;
        writeFloat64(holding, reg * 2, value);
    }
    
    // 701-800: double (8 register), 0'dan başla
    // Her 8 register bir double değeri (toplam 12-13 değer)
    for (let reg = 701; reg <= 800; reg += 8) {
        const valueIndex = Math.floor((reg - 701) / 8);
        const value = valueIndex * 0.444;
        writeFloat64(holding, reg * 2, value);
    }
    
    // 801-900: string, sabit "Hello, World!"
    const fixedString = "Hello, World!";
    const stringBytes = Buffer.from(fixedString, 'utf8');
    const startOffset = 801 * 2; // Register 801'in byte offset'i
    stringBytes.copy(holding, startOffset);
    // Kalan byte'ları 0 ile doldur (901'e kadar)
    const endOffset = 901 * 2;
    for (let i = startOffset + stringBytes.length; i < endOffset; i++) {
        holding[i] = 0;
    }
    
    // 901-1000: string, dinamik epoch time ile
    updateEpochTimeString();
}

// Epoch time string'ini güncelle
function updateEpochTimeString() {
    const holding = holdingBuffer;
    const epochTime = Math.floor(Date.now() / 1000);
    const dynamicString = `Hello, World! ${epochTime}`;
    const stringBytes = Buffer.from(dynamicString, 'utf8');
    const startOffset = 901 * 2; // Register 901'in byte offset'i
    stringBytes.copy(holding, startOffset);
    // Kalan byte'ları 0 ile doldur (1001'e kadar)
    const endOffset = 1001 * 2;
    for (let i = startOffset + stringBytes.length; i < endOffset; i++) {
        holding[i] = 0;
    }
}

// Holding Register'ları her saniye güncelle
function updateHoldingRegisters() {
    const holding = holdingBuffer;
    
    // 0-100: int16, her saniye +1
    // max değer i=100 iken olur, o yüzden base için güvenli üst sınır: max-100
    if (holdingRegisterValues.int16 >= (LIMITS.int16.max - 100)) {
        holdingRegisterValues.int16 = START_VALUES.int16;
    } else {
        holdingRegisterValues.int16++;
    }
    for (let i = 0; i <= 100; i++) {
        // Client tarafından yazılan adresleri atla
        if (!clientWrittenHoldingRegisters.has(i)) {
            writeInt16(holding, i * 2, holdingRegisterValues.int16 + i);
        }
    }
    
    // 101-200: uint16, her saniye +1
    // max değer (i-101)=99 iken olur => max-99
    if (holdingRegisterValues.uint16 >= (LIMITS.uint16.max - 99)) {
        holdingRegisterValues.uint16 = START_VALUES.uint16;
    } else {
        holdingRegisterValues.uint16++;
    }
    for (let i = 101; i <= 200; i++) {
        // Client tarafından yazılan adresleri atla
        if (!clientWrittenHoldingRegisters.has(i)) {
            writeUInt16(holding, i * 2, holdingRegisterValues.uint16 + (i - 101));
        }
    }
    
    // 201-300: int32, her saniye +1
    // 201-300 aralığında toplam 50 değer var (reg 201..300 step 2 => index 0..49)
    if (holdingRegisterValues.int32 >= (LIMITS.int32.max - 49)) {
        holdingRegisterValues.int32 = START_VALUES.int32;
    } else {
        holdingRegisterValues.int32++;
    }
    for (let reg = 201; reg <= 300; reg += 2) {
        // Client tarafından yazılan adresleri atla (her int32 2 register kullanır)
        const isWritten = clientWrittenHoldingRegisters.has(reg) || clientWrittenHoldingRegisters.has(reg + 1);
        if (!isWritten) {
            const valueIndex = Math.floor((reg - 201) / 2);
            const value = holdingRegisterValues.int32 + valueIndex;
            writeInt32(holding, reg * 2, value);
        }
    }
    
    // 301-400: uint32, her saniye +1
    if (holdingRegisterValues.uint32 >= (LIMITS.uint32.max - 49)) {
        holdingRegisterValues.uint32 = START_VALUES.uint32;
    } else {
        holdingRegisterValues.uint32++;
    }
    for (let reg = 301; reg <= 400; reg += 2) {
        // Client tarafından yazılan adresleri atla (her uint32 2 register kullanır)
        const isWritten = clientWrittenHoldingRegisters.has(reg) || clientWrittenHoldingRegisters.has(reg + 1);
        if (!isWritten) {
            const valueIndex = Math.floor((reg - 301) / 2);
            const value = holdingRegisterValues.uint32 + valueIndex;
            writeUInt32(holding, reg * 2, value);
        }
    }
    
    // 401-500: float32, her saniye +0.111
    holdingRegisterValues.float16 += 0.111;
    // Sonsuz büyümeyi engelle (uzun süreli test için)
    if (!Number.isFinite(holdingRegisterValues.float16) || Math.abs(holdingRegisterValues.float16) > 1e6) {
        holdingRegisterValues.float16 = START_VALUES.float16;
    }
    for (let reg = 401; reg <= 500; reg += 2) {
        // Client tarafından yazılan adresleri atla (her float32 2 register kullanır)
        const isWritten = clientWrittenHoldingRegisters.has(reg) || clientWrittenHoldingRegisters.has(reg + 1);
        if (!isWritten) {
            const valueIndex = Math.floor((reg - 401) / 2);
            const value = holdingRegisterValues.float16 + valueIndex * 0.111;
            writeFloat32(holding, reg * 2, value);
        }
    }
    
    // 501-600: float32, her saniye +0.222
    holdingRegisterValues.float32 += 0.222;
    if (!Number.isFinite(holdingRegisterValues.float32) || Math.abs(holdingRegisterValues.float32) > 1e6) {
        holdingRegisterValues.float32 = START_VALUES.float32;
    }
    for (let reg = 501; reg <= 600; reg += 2) {
        // Client tarafından yazılan adresleri atla (her float32 2 register kullanır)
        const isWritten = clientWrittenHoldingRegisters.has(reg) || clientWrittenHoldingRegisters.has(reg + 1);
        if (!isWritten) {
            const valueIndex = Math.floor((reg - 501) / 2);
            const value = holdingRegisterValues.float32 + valueIndex * 0.222;
            writeFloat32(holding, reg * 2, value);
        }
    }
    
    // 601-700: float64, her saniye +0.333
    holdingRegisterValues.float64 += 0.333;
    if (!Number.isFinite(holdingRegisterValues.float64) || Math.abs(holdingRegisterValues.float64) > 1e12) {
        holdingRegisterValues.float64 = START_VALUES.float64;
    }
    for (let reg = 601; reg <= 700; reg += 4) {
        // Client tarafından yazılan adresleri atla (her float64 4 register kullanır)
        const isWritten = clientWrittenHoldingRegisters.has(reg) || clientWrittenHoldingRegisters.has(reg + 1) ||
                         clientWrittenHoldingRegisters.has(reg + 2) || clientWrittenHoldingRegisters.has(reg + 3);
        if (!isWritten) {
            const valueIndex = Math.floor((reg - 601) / 4);
            const value = holdingRegisterValues.float64 + valueIndex * 0.333;
            writeFloat64(holding, reg * 2, value);
        }
    }
    
    // 701-800: double, her saniye +0.444
    holdingRegisterValues.double += 0.444;
    if (!Number.isFinite(holdingRegisterValues.double) || Math.abs(holdingRegisterValues.double) > 1e12) {
        holdingRegisterValues.double = START_VALUES.double;
    }
    for (let reg = 701; reg <= 800; reg += 8) {
        // Client tarafından yazılan adresleri atla (her double 8 register kullanır)
        const isWritten = clientWrittenHoldingRegisters.has(reg) || clientWrittenHoldingRegisters.has(reg + 1) ||
                         clientWrittenHoldingRegisters.has(reg + 2) || clientWrittenHoldingRegisters.has(reg + 3) ||
                         clientWrittenHoldingRegisters.has(reg + 4) || clientWrittenHoldingRegisters.has(reg + 5) ||
                         clientWrittenHoldingRegisters.has(reg + 6) || clientWrittenHoldingRegisters.has(reg + 7);
        if (!isWritten) {
            const valueIndex = Math.floor((reg - 701) / 8);
            const value = holdingRegisterValues.double + valueIndex * 0.444;
            writeFloat64(holding, reg * 2, value);
        }
    }
    
    // 801-900: string sabit, değişmez
    // Client tarafından yazılan adresleri kontrol et
    let shouldUpdateString = true;
    for (let reg = 801; reg <= 900; reg++) {
        if (clientWrittenHoldingRegisters.has(reg)) {
            shouldUpdateString = false;
            break;
        }
    }
    // Eğer client tarafından yazılmadıysa string'i güncelle (zaten sabit, ama yine de kontrol ediyoruz)
    
    // 901-1000: string dinamik, epoch time güncelle
    // Client tarafından yazılan adresleri kontrol et
    let shouldUpdateEpochString = true;
    for (let reg = 901; reg <= 1000; reg++) {
        if (clientWrittenHoldingRegisters.has(reg)) {
            shouldUpdateEpochString = false;
            break;
        }
    }
    if (shouldUpdateEpochString) {
        updateEpochTimeString();
    }
}

// Coil'leri başlangıç değerleriyle doldur
function initializeCoils() {
    const coil = coilBuffer;
    
    // 0-100: toggle için başlangıç değeri 0
    for (let i = 0; i <= 100; i++) {
        coilToggleState[i] = 0;
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        coil[byteIndex] &= ~(1 << bitIndex); // 0 yap
    }
    
    // 101-200: sabit 0
    for (let i = 101; i <= 200; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        coil[byteIndex] &= ~(1 << bitIndex); // 0 yap
    }
    
    // 201-300: sabit 1
    for (let i = 201; i <= 300; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        coil[byteIndex] |= (1 << bitIndex); // 1 yap
    }
}

// Coil'leri her saniye güncelle
function updateCoils() {
    const coil = coilBuffer;
    
    // 0-100: toggle (0→1→0→1)
    for (let i = 0; i <= 100; i++) {
        // Client tarafından yazılan coil'leri atla
        if (!clientWrittenCoils.has(i)) {
            coilToggleState[i] = coilToggleState[i] === 0 ? 1 : 0;
            const byteIndex = Math.floor(i / 8);
            const bitIndex = i % 8;
            if (coilToggleState[i]) {
                coil[byteIndex] |= (1 << bitIndex);
            } else {
                coil[byteIndex] &= ~(1 << bitIndex);
            }
        }
    }
    
    // 101-200: sabit 0, değişmez (client yazsa bile otomatik güncelleme yapmıyoruz)
    // 201-300: sabit 1, değişmez (client yazsa bile otomatik güncelleme yapmıyoruz)
}

// Discrete Input'ları başlangıç değerleriyle doldur
function initializeDiscreteInputs() {
    const discrete = discreteBuffer;
    
    // 0-100: toggle için başlangıç değeri 0
    for (let i = 0; i <= 100; i++) {
        discreteInputToggleState[i] = 0;
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        discrete[byteIndex] &= ~(1 << bitIndex); // 0 yap
    }
    
    // 101-200: sabit 0
    for (let i = 101; i <= 200; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        discrete[byteIndex] &= ~(1 << bitIndex); // 0 yap
    }
    
    // 201-300: sabit 1
    for (let i = 201; i <= 300; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        discrete[byteIndex] |= (1 << bitIndex); // 1 yap
    }
}

// Discrete Input'ları her saniye güncelle
function updateDiscreteInputs() {
    const discrete = discreteBuffer;
    
    // 0-100: toggle (0→1→0→1)
    for (let i = 0; i <= 100; i++) {
        // Client tarafından yazılan discrete input'ları atla (Modbus protokolünde write yok ama simülasyon için takip ediyoruz)
        if (!clientWrittenDiscreteInputs.has(i)) {
            discreteInputToggleState[i] = discreteInputToggleState[i] === 0 ? 1 : 0;
            const byteIndex = Math.floor(i / 8);
            const bitIndex = i % 8;
            if (discreteInputToggleState[i]) {
                discrete[byteIndex] |= (1 << bitIndex);
            } else {
                discrete[byteIndex] &= ~(1 << bitIndex);
            }
        }
    }
    
    // 101-200: sabit 0, değişmez (client yazsa bile otomatik güncelleme yapmıyoruz)
    // 201-300: sabit 1, değişmez (client yazsa bile otomatik güncelleme yapmıyoruz)
}

// Modbus TCP Server event handlers
modbusServer.on("readHoldingRegisters", function(addr, length, unitID) {
    console.log(`Holding Register okuma: Address=${addr}, Length=${length}, UnitID=${unitID}`);
});

// Write event'leri için doğru parametreleri kullan (request, cb)
modbusServer.on("preWriteSingleRegister", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const value = request.body.value;
        console.log(`[PRE] Holding Register yazma (Single): Address=${addr}, Value=${value}`);
        // Buffer'a yazılmadan önceki değeri göster
        const oldValue = holdingBuffer.readUInt16BE(addr * 2);
        console.log(`[PRE] Buffer'daki eski değer: ${oldValue}`);
    }
});

modbusServer.on("writeSingleRegister", function(request, cb) {
    // Bu event sadece buffer yoksa tetiklenir, bizim buffer'ımız var
    console.log(`[FALLBACK] Holding Register yazma (Single): Buffer yok, handler çağrıldı`);
    if (request && request.body) {
        const addr = request.body.address;
        const value = request.body.value;
        console.log(`[FALLBACK] Address=${addr}, Value=${value}`);
        // Manuel olarak buffer'a yaz
        holdingBuffer.writeUInt16BE(value, addr * 2);
        clientWrittenHoldingRegisters.add(addr);
    }
    // Callback'i çağır
    if (cb) {
        const responseBody = { address: request.body.address, value: request.body.value };
        cb(responseBody);
    }
});

modbusServer.on("postWriteSingleRegister", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const value = request.body.value;
        console.log(`[POST] Holding Register yazma (Single): Address=${addr}, Value=${value}`);
        // Buffer'a yazıldıktan sonraki değeri kontrol et
        const newValue = holdingBuffer.readUInt16BE(addr * 2);
        console.log(`[POST] Buffer'daki yeni değer: ${newValue}`);
        // Client tarafından yazılan adresi işaretle (otomatik güncellemeyi engelle)
        clientWrittenHoldingRegisters.add(addr);
        console.log(`[POST] Adres ${addr} client tarafından yazıldı olarak işaretlendi`);
    }
});

modbusServer.on("preWriteMultipleRegisters", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const quantity = request.body.quantity;
        console.log(`[PRE] Holding Register yazma (Multiple): Address=${addr}, Quantity=${quantity}`);
    }
});

modbusServer.on("writeMultipleRegisters", function(buffer) {
    // Bu event buffer ile emit ediliyor (satır 243'te görüldüğü gibi)
    // Buffer güncellendikten SONRA çağrılıyor
    console.log(`[MIDDLE] Holding Register yazma (Multiple): Buffer güncellendi, buffer uzunluğu: ${buffer.length}`);
});

modbusServer.on("postWriteMultipleRegisters", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const quantity = request.body.quantity;
        console.log(`[POST] Holding Register yazma (Multiple): Address=${addr}, Quantity=${quantity}`);
        // Buffer'daki değerleri kontrol et
        for (let i = 0; i < quantity; i++) {
            const regAddr = addr + i;
            const value = holdingBuffer.readUInt16BE(regAddr * 2);
            console.log(`[POST] Register ${regAddr} değeri: ${value}`);
            // Client tarafından yazılan tüm adresleri işaretle
            clientWrittenHoldingRegisters.add(regAddr);
        }
        console.log(`[POST] ${quantity} adres client tarafından yazıldı olarak işaretlendi`);
    }
});

modbusServer.on("readInputRegisters", function(addr, length, unitID) {
    console.log(`Input Register okuma: Address=${addr}, Length=${length}, UnitID=${unitID}`);
});

modbusServer.on("readCoils", function(addr, length, unitID) {
    console.log(`Coil okuma: Address=${addr}, Length=${length}, UnitID=${unitID}`);
});

modbusServer.on("preWriteSingleCoil", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const value = request.body.value;
        console.log(`[PRE] Coil yazma (Single): Address=${addr}, Value=${value}`);
        // Buffer'a yazılmadan önceki değeri göster
        const byteIndex = Math.floor(addr / 8);
        const bitIndex = addr % 8;
        const oldValue = (coilBuffer[byteIndex] >> bitIndex) & 1;
        console.log(`[PRE] Buffer'daki eski değer: ${oldValue}`);
    }
});

modbusServer.on("writeSingleCoil", function(request, cb) {
    // Bu event sadece buffer yoksa tetiklenir, bizim buffer'ımız var
    console.log(`[FALLBACK] Coil yazma (Single): Buffer yok, handler çağrıldı`);
    if (request && request.body) {
        const addr = request.body.address;
        const value = request.body.value;
        console.log(`[FALLBACK] Address=${addr}, Value=${value}`);
        // Manuel olarak buffer'a yaz
        const byteIndex = Math.floor(addr / 8);
        const bitIndex = addr % 8;
        if (value === 0xFF00 || value === true || value === 1) {
            coilBuffer[byteIndex] |= (1 << bitIndex);
        } else {
            coilBuffer[byteIndex] &= ~(1 << bitIndex);
        }
        clientWrittenCoils.add(addr);
    }
    // Callback'i çağır
    if (cb) {
        const responseBody = { address: request.body.address, value: request.body.value };
        cb(responseBody);
    }
});

modbusServer.on("postWriteSingleCoil", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const value = request.body.value;
        console.log(`[POST] Coil yazma (Single): Address=${addr}, Value=${value}`);
        // Buffer'a yazıldıktan sonraki değeri kontrol et
        const byteIndex = Math.floor(addr / 8);
        const bitIndex = addr % 8;
        const newValue = (coilBuffer[byteIndex] >> bitIndex) & 1;
        console.log(`[POST] Buffer'daki yeni değer: ${newValue}`);
        // Client tarafından yazılan adresi işaretle (otomatik güncellemeyi engelle)
        clientWrittenCoils.add(addr);
        console.log(`[POST] Coil ${addr} client tarafından yazıldı olarak işaretlendi`);
    }
});

modbusServer.on("preWriteMultipleCoils", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const quantity = request.body.quantity;
        console.log(`[PRE] Coil yazma (Multiple): Address=${addr}, Quantity=${quantity}`);
    }
});

modbusServer.on("writeMultipleCoils", function(buffer, oldStatus) {
    // Bu event buffer ve eski status ile emit ediliyor (satır 215'te görüldüğü gibi)
    // Buffer güncellendikten ÖNCE çağrılıyor
    console.log(`[MIDDLE] Coil yazma (Multiple): Buffer güncelleniyor, buffer uzunluğu: ${buffer.length}`);
});

modbusServer.on("postWriteMultipleCoils", function(request, cb) {
    if (request && request.body) {
        const addr = request.body.address;
        const quantity = request.body.quantity;
        console.log(`[POST] Coil yazma (Multiple): Address=${addr}, Quantity=${quantity}`);
        // Buffer'daki değerleri kontrol et
        for (let i = 0; i < quantity; i++) {
            const coilAddr = addr + i;
            const byteIndex = Math.floor(coilAddr / 8);
            const bitIndex = coilAddr % 8;
            const value = (coilBuffer[byteIndex] >> bitIndex) & 1;
            console.log(`[POST] Coil ${coilAddr} değeri: ${value}`);
            // Client tarafından yazılan tüm adresleri işaretle
            clientWrittenCoils.add(coilAddr);
        }
        console.log(`[POST] ${quantity} coil client tarafından yazıldı olarak işaretlendi`);
    }
});

modbusServer.on("readDiscreteInputs", function(addr, length, unitID) {
    console.log(`Discrete Input okuma: Address=${addr}, Length=${length}, UnitID=${unitID}`);
});

// TCP Server bağlantı eventleri
let activeConnections = 0;

tcpServer.on("connection", function(socket) {
    activeConnections++;
    console.log(`\n🔌 Yeni Modbus TCP bağlantısı oluşturuldu!`);
    console.log(`   📍 IP: ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`   📊 Aktif bağlantı sayısı: ${activeConnections}\n`);
    
    socket.on("close", function() {
        activeConnections--;
        console.log(`\n🔌 Modbus TCP bağlantısı kapatıldı!`);
        console.log(`   📍 IP: ${socket.remoteAddress}:${socket.remotePort}`);
        console.log(`   📊 Aktif bağlantı sayısı: ${activeConnections}\n`);
    });
    
    socket.on("error", function(err) {
        console.error(`❌ Socket hatası (${socket.remoteAddress}:${socket.remotePort}):`, err);
    });
});

tcpServer.on("error", function(err) {
    console.error("TCP Server Hatası:", err);
});

modbusServer.on("error", function(err) {
    console.error("Modbus Server Hatası:", err);
});

// Başlangıç değerlerini ayarla
initializeHoldingRegisters();
initializeCoils();
initializeDiscreteInputs();

// Her saniye güncelleme yap
const updateInterval = setInterval(function() {
    updateHoldingRegisters();
    updateCoils();
    updateDiscreteInputs();
}, 1000);

// TCP Server'ı başlat
tcpServer.listen(PORT, "0.0.0.0", function() {
    console.log("\n✅ Modbus TCP Server hazır ve dinliyor...");
    console.log(`📡 Bağlantı için: tcp://0.0.0.0:${PORT} (Slave ID: ${SLAVE_ID})`);
    console.log(`📋 Desteklenen Function Codes:`);
    console.log(`   - FC 01: Read Coils`);
    console.log(`   - FC 02: Read Discrete Inputs`);
    console.log(`   - FC 03: Read Holding Registers`);
    console.log(`   - FC 04: Read Input Registers`);
    console.log(`   - FC 05: Write Single Coil`);
    console.log(`   - FC 06: Write Single Register`);
    console.log(`   - FC 15: Write Multiple Coils`);
    console.log(`   - FC 16: Write Multiple Registers`);
    console.log(`\n🔄 Tüm değerler her saniye otomatik olarak güncelleniyor...\n`);
});

// Graceful shutdown
process.on("SIGINT", function() {
    console.log("\n\nModbus TCP Server kapatılıyor...");
    clearInterval(updateInterval);
    tcpServer.close(function() {
        console.log("Server kapatıldı.");
        process.exit(0);
    });
});
