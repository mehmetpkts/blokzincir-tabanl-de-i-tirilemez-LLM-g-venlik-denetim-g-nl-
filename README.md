# LLMAuditLog

Blokzincir tabanli, degistirilemez LLM guvenlik denetim gunlugu.

Bu proje, LLM islemlerinin ham metinlerini degil; yalnizca kriptografik hash degerlerini zincire yazar.
Boylece hem denetlenebilirlik hem de veri gizliligi birlikte korunur.

## Ozellikler

- Role-based yazma yetkisi (OpenZeppelin AccessControl)
- Tekli kayit ekleme: addAuditRecord
- Toplu kayit ekleme: addAuditRecordsBatch
- Olay takibi: AuditRecordAdded
- Okuma fonksiyonlari:
  - getRecordCount
  - getRecord
  - getRecords (offset/limit ile sayfalama)

## Teknoloji

- Solidity 0.8.20
- Hardhat
- OpenZeppelin Contracts

## Kurulum

1. Bagimliliklari yukle

```bash
npm install
```

2. Ortam degiskenlerini hazirla

```bash
copy .env.example .env
```

3. Derle

```bash
npm run compile
```

4. Testleri calistir

```bash
npm test
```

## Ortam Degiskenleri

- LOGGER_ADDRESS: Ilk yetkili logger adresi (bos birakilirsa deployer adresi kullanilir)
- LOCALHOST_RPC_URL: Yerel node URL
- SEPOLIA_RPC_URL: Sepolia RPC URL
- DEPLOYER_PRIVATE_KEY: Sepolia deploy hesabinin private key degeri
- ETHERSCAN_API_KEY: Sozlesme dogrulamasi icin API anahtari

## Local Gelistirme

1. Yerel node baslat

```bash
npm run node
```

2. Ayrı bir terminalde deploy et

```bash
npm run deploy:local
```

## Sepolia Deploy

1. .env dosyasinda asagidakileri doldur
- SEPOLIA_RPC_URL
- DEPLOYER_PRIVATE_KEY
- LOGGER_ADDRESS (opsiyonel)

2. Deploy oncesi hazirlik kontrolu

```bash
npm run precheck:sepolia
```

3. Deploy komutu

```bash
npm run deploy:sepolia
```

4. Etherscan dogrulama (ornek)

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS> <LOGGER_ADDRESS>
```

Not: Deploy ciktilarinda constructor argumanlari yazdirilir. Dogrulamada ayni argumanlari kullan.

## Backend Entegrasyonu: Hash Uretimi

Zincire yazmadan once prompt, response ve reasoning alanlarini backend tarafinda hashleyin.

Ornek Node.js:

```javascript
const { keccak256, toUtf8Bytes } = require("ethers");

function hashText(value) {
  return keccak256(toUtf8Bytes(value));
}

const promptHash = hashText(promptText);
const responseHash = hashText(responseText);
const reasoningHash = hashText(reasoningText);
```

## Backend Entegrasyonu: Tekli Kayit

```javascript
const tx = await contract.addAuditRecord(
  actorAddress,
  promptHash,
  responseHash,
  reasoningHash
);
await tx.wait();
```

## Backend Entegrasyonu: Toplu Kayit

```javascript
const batch = [
  { actor: actor1, promptHash: p1, responseHash: r1, reasoningHash: c1 },
  { actor: actor2, promptHash: p2, responseHash: r2, reasoningHash: c2 }
];

const tx = await contract.addAuditRecordsBatch(batch);
await tx.wait();
```

## Event Dinleme

```javascript
contract.on(
  "AuditRecordAdded",
  (recordId, actor, promptHash, responseHash, reasoningHash, timestamp, logger) => {
    console.log({
      recordId: recordId.toString(),
      actor,
      promptHash,
      responseHash,
      reasoningHash,
      timestamp: timestamp.toString(),
      logger
    });
  }
);
```

## Backend Servisi Calistirma

1. .env dosyasina backend degiskenlerini gir
- AUDIT_CONTRACT_ADDRESS
- BACKEND_PRIVATE_KEY
- BACKEND_API_KEY (opsiyonel)

2. Servisi baslat

```bash
npm run start:backend
```

Dashboard:
- http://localhost:3001/dashboard.html
- Canli event stream: /events/stream (SSE)
- Son eventler: /events/recent
- Dashboard ozellikleri:
  - Actor/Logger filtreleri
  - Etherscan tx linkleri

3. Tekli log istegi ornegi

```bash
curl -X POST http://localhost:3001/audit-log \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_BACKEND_API_KEY" \
  -d '{
    "actor": "0x1111111111111111111111111111111111111111",
    "prompt": "What is threat modeling?",
    "response": "Threat modeling is ...",
    "reasoning": "Step-by-step hidden reasoning"
  }'
```

4. Toplu log istegi ornegi

```bash
curl -X POST http://localhost:3001/audit-log/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_BACKEND_API_KEY" \
  -d '{
    "items": [
      {
        "actor": "0x1111111111111111111111111111111111111111",
        "prompt": "p1",
        "response": "r1",
        "reasoning": "c1"
      },
      {
        "actor": "0x2222222222222222222222222222222222222222",
        "prompt": "p2",
        "response": "r2",
        "reasoning": "c2"
      }
    ]
  }'
```

## Sayfalama Ornegi

```javascript
const page = await contract.getRecords(0, 25);
console.log("Page size:", page.length);
```

## Guvenlik Notlari

- Private key degerlerini repoya yazmayin.
- Production icin ayri deployer ve ayri logger adresleri kullanin.
- LOGGER_ROLE yalnizca backend servis cüzdanlarinda olmali.
- Ham LLM metinlerini zincire yazmayin; sadece hash yazin.

## Logger Rol Devri (Ayrik Cuzdana Gecis)

1. Yeni logger cüzdani olustur ve .env guncelle

```bash
npm run generate:logger
```

2. Zincirde rol devrini yap (grant yeni logger, revoke deployer logger)

```bash
npm run rotate:logger
```

3. Kontrol
- /health endpoint'inde backend wallet yeni logger adresi olmali.
- Yeni /audit-log isleminde event `logger` alani yeni adres olmali.

## Demo Veri Uretimi (Seeder)

Tek komutla zincire demo kayitlari bas:

```bash
npm run seed:demo -- 5
```

Not:
- Parametre verilmezse varsayilan 3 kayit yazar.
- Maksimum 20 kayitla sinirlidir.

## Sunum Dosyalari

- Mimari diyagram: docs/mimari-diyagram.md
- Demo akisi: docs/demo-senaryosu.md
- Tek sayfa ozet: docs/proje-ozet-tek-sayfa.md
