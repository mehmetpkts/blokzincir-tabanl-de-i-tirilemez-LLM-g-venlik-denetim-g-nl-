# Demo Senaryosu - 10 Dakikalik Sunum Akisi

## 1) Giris (1 dk)

- Problem: LLM ciktilari ve reasoning surecinin sonradan manipule edilmesi riski.
- Cozum: Ham veri yerine hash degerlerini degistirilemez bicimde blokzincire yazmak.

## 2) Mimariyi Goster (1 dk)

- `docs/mimari-diyagram.md` dosyasindaki diyagrami ac.
- Veri akisini ozetle: LLM -> Hash -> Backend -> Smart Contract -> Event -> Dashboard.

## 3) Zincir Durumunu Goster (2 dk)

1. Sepolia kontrat sayfasini ac:
- https://sepolia.etherscan.io/address/0x39af8B64f8CF45c5d1886aa8Ef90984f8f862452#code

2. Verify durumunu goster:
- Source code verified.

3. Rolleri acikla:
- Deployer artik logger degil.
- Ayrik logger cuzdan yazma yapiyor.

## 4) Canli Yazim ve Event Akisi (3 dk)

1. Backend servisinin calistigini goster:
```bash
npm run start:backend
```

2. Dashboard'u ac:
- http://localhost:3001/dashboard.html

3. Ornek tekli log gonder:
```bash
curl -X POST http://localhost:3001/audit-log \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_BACKEND_API_KEY" \
  -d '{
    "actor": "0x2b6dC85524065415043730424BEd268ae75C3575",
    "prompt": "Threat modeling for LLM pipeline",
    "response": "Model output sample",
    "reasoning": "Internal reasoning summary"
  }'
```

4. Dashboard'da yeni event satirinin anlik dustugunu goster.

## 5) Butunluk Kaniti (2 dk)

1. Ayni prompt metninden hash uret (local script veya node snippet).
2. Zincirdeki `promptHash` ile birebir esit oldugunu goster.
3. Metin degistiginde hash'in tamamen degistigini vurgula.

## 6) Guvenlik ve Kapanis (1 dk)

- Neden ham metin degil hash sakladik?
- Neden role-based access control kullandik?
- Neden ayrik logger cuzdani kullandik?
- Sonuc: Denetlenebilir, degistirilemez, gizlilik-dostu audit altyapisi.

## Yedek Plan (Risklere Karsi)

1. Sepolia yavaslarsa:
- Onceden alinmis tx hash ve Etherscan kayitlarini goster.

2. RPC kesintisi olursa:
- `/events/recent` ile son event listesini lokalde goster.

3. API key unutulursa:
- Header'li ve headersiz test farkini acikla.
