# Modbus Register Gereksinimleri

Bu doküman, Modbus TCP Server'daki tüm register türlerinin (Holding Register, Input Register, Coil, Discrete Input) veri tipi ve davranış gereksinimlerini açıklar.

## Genel Bilgiler

Tüm değerler her saniye otomatik olarak güncellenir. Aşağıdaki tabloda her bir aralık için detaylı bilgiler bulunmaktadır.

## Holding Register Aralıkları ve Özellikleri

| Register Aralığı | Veri Tipi | Register Sayısı | Başlangıç Değeri | Artış Miktarı (Saniyede) | Açıklama |
|-----------------|-----------|-----------------|------------------|--------------------------|----------|
| 0-100 | int16 | 1 | -16000 | +1 | 16-bit işaretli tam sayı, -16000'den başlayıp her saniye 1 artar |
| 101-200 | uint16 | 1 | 1 | +1 | 16-bit işaretsiz tam sayı, 1'den başlayıp her saniye 1 artar |
| 201-300 | int32 | 2 | -10000.0 | +1 | 32-bit işaretli tam sayı, -10000.0'den başlayıp her saniye 1 artar |
| 301-400 | uint32 | 2 | 0 | +1 | 32-bit işaretsiz tam sayı, 0'dan başlayıp her saniye 1 artar |
| 401-500 | float16 | 2 | -10000.0 | +0.111 | 16-bit kayan nokta, -10000.0'den başlayıp her saniye 0.111 artar |
| 501-600 | float32 | 2 | 0 | +0.222 | 32-bit kayan nokta, 0'dan başlayıp her saniye 0.222 artar |
| 601-700 | float64 | 4 | 0 | +0.333 | 64-bit kayan nokta, 0'dan başlayıp her saniye 0.333 artar |
| 701-800 | double | 8 | 0 | +0.444 | Çift hassasiyetli kayan nokta (8 register), 0'dan başlayıp her saniye 0.444 artar |
| 801-900 | string | Değişken | "Hello, World!" | - | Sabit string değeri "Hello, World!" |
| 901-1000 | string | Değişken | "Hello, World! {epochtime string}" | - | Epoch zamanı içeren dinamik string değeri |

## Holding Register Detaylı Açıklamalar

### 0-100: int16 (İşaretli 16-bit Tam Sayı)
- **Register Sayısı:** Her değer 1 register kullanır
- **Başlangıç Değeri:** -16000
- **Güncelleme:** Her saniye +1 artar

### 101-200: uint16 (İşaretsiz 16-bit Tam Sayı)
- **Register Sayısı:** Her değer 1 register kullanır
- **Başlangıç Değeri:** 1
- **Güncelleme:** Her saniye +1 artar

### 201-300: int32 (İşaretli 32-bit Tam Sayı)
- **Register Sayısı:** Her değer 2 register kullanır
- **Başlangıç Değeri:** -10000.0
- **Güncelleme:** Her saniye +1 artar

### 301-400: uint32 (İşaretsiz 32-bit Tam Sayı)
- **Register Sayısı:** Her değer 2 register kullanır
- **Başlangıç Değeri:** 0
- **Güncelleme:** Her saniye +1 artar

### 401-500: float16 (16-bit Kayan Nokta)
- **Register Sayısı:** Her değer 2 register kullanır
- **Başlangıç Değeri:** -10000.0
- **Güncelleme:** Her saniye +0.111 artar

### 501-600: float32 (32-bit Kayan Nokta)
- **Register Sayısı:** Her değer 2 register kullanır
- **Başlangıç Değeri:** 0
- **Güncelleme:** Her saniye +0.222 artar

### 601-700: float64 (64-bit Kayan Nokta)
- **Register Sayısı:** Her değer 4 register kullanır
- **Başlangıç Değeri:** 0
- **Güncelleme:** Her saniye +0.333 artar

### 701-800: double (Çift Hassasiyetli Kayan Nokta)
- **Register Sayısı:** Her değer 8 register kullanır
- **Başlangıç Değeri:** 0
- **Güncelleme:** Her saniye +0.444 artar

### 801-900: String (Sabit)
- **İçerik:** "Hello, World!"
- **Güncelleme:** Sabit değer, değişmez

### 901-1000: String (Dinamik - Epoch Time)
- **İçerik:** "Hello, World! {epochtime string}"
- **Açıklama:** Epoch zamanı string formatında dinamik olarak güncellenir
- **Örnek:** "Hello, World! 1704067200" (epoch time'a göre değişir)

---

## Coil Gereksinimleri

Coil'ler (Function Code 01/05/15) boolean değerler için kullanılır. Okunabilir ve yazılabilir.

| Coil Aralığı | Değer | Güncelleme | Açıklama |
|-------------|-------|------------|----------|
| 0-100 | 0 veya 1 | Her saniye toggle | Her saniye 0 ve 1 arasında değişir (0→1→0→1...) |
| 101-200 | 0 | Sabit | Her zaman 0 değerinde kalır |
| 201-300 | 1 | Sabit | Her zaman 1 değerinde kalır |

### Coil Detaylı Açıklamalar

#### 0-100: Toggle Coil'ler
- **Davranış:** Her saniye otomatik olarak 0 ve 1 arasında değişir
- **Güncelleme:** Her saniye bir önceki değerin tersi alınır (0 ise 1, 1 ise 0)
- **Kullanım:** Test ve simülasyon amaçlı dinamik değer üretimi

#### 101-200: Sabit 0 Coil'ler
- **Davranış:** Her zaman 0 (OFF/LOW) değerinde kalır
- **Güncelleme:** Değişmez, sabit değer

#### 201-300: Sabit 1 Coil'ler
- **Davranış:** Her zaman 1 (ON/HIGH) değerinde kalır
- **Güncelleme:** Değişmez, sabit değer

---

## Discrete Input Gereksinimleri

Discrete Input'lar (Function Code 02) sadece okunabilir boolean değerler için kullanılır.

| Discrete Input Aralığı | Değer | Güncelleme | Açıklama |
|----------------------|-------|------------|----------|
| 0-100 | 0 veya 1 | Her saniye toggle | Her saniye 0 ve 1 arasında değişir (0→1→0→1...) |
| 101-200 | 0 | Sabit | Her zaman 0 değerinde kalır |
| 201-300 | 1 | Sabit | Her zaman 1 değerinde kalır |

### Discrete Input Detaylı Açıklamalar

#### 0-100: Toggle Discrete Input'lar
- **Davranış:** Her saniye otomatik olarak 0 ve 1 arasında değişir
- **Güncelleme:** Her saniye bir önceki değerin tersi alınır (0 ise 1, 1 ise 0)
- **Kullanım:** Test ve simülasyon amaçlı dinamik değer üretimi
- **Not:** Coil'lerden farklı olarak sadece okunabilir, yazılamaz

#### 101-200: Sabit 0 Discrete Input'lar
- **Davranış:** Her zaman 0 (OFF/LOW) değerinde kalır
- **Güncelleme:** Değişmez, sabit değer

#### 201-300: Sabit 1 Discrete Input'lar
- **Davranış:** Her zaman 1 (ON/HIGH) değerinde kalır
- **Güncelleme:** Değişmez, sabit değer

---

## Genel Notlar

- Tüm sayısal değerler her saniye otomatik olarak güncellenir
- String değerler register başına byte sayısına göre register sayısı değişkenlik gösterebilir
- Epoch time string'i, Unix timestamp'ini string formatında temsil eder
- Register adresleri 0-indexed'dir (0'dan başlar)
- Coil ve Discrete Input'lar boolean değerlerdir (0 veya 1)
- Coil'ler okunabilir ve yazılabilir, Discrete Input'lar sadece okunabilir

