# Proje Ozet Raporu (Tek Sayfa)

## Proje Basligi
Blokzincir Tabanli Degistirilemez LLM Guvenlik Denetim Gunlugu

## Problem Tanimi
LLM sistemlerinde prompt, model cevabi ve reasoning sureci sonradan degistirilebilir veya inkar edilebilir.
Bu durum adli analiz, denetim izi ve guvenilirlik acisindan kritik bir risktir.

## Cozum Ozeti
Ham metinleri zincire yazmak yerine sadece kriptografik ozetlerini (hash) yaziyoruz.
Boylece:
- Veri gizliligi korunuyor.
- Kayitlar degistirilemez hale geliyor.
- Sonradan butunluk dogrulamasi yapilabiliyor.

## Teknik Mimari
1. LLM katmani prompt/response/reasoning uretir.
2. Backend bu alanlari `keccak256` ile hashler.
3. Yetkili logger cuzdani `LLMAuditLog` sozlesmesine yazar.
4. Sozlesme `AuditRecordAdded` eventi yayinlar.
5. Dashboard SSE ile eventleri canli gosterir.

Detayli diyagram: docs/mimari-diyagram.md

## Kullanilan Teknolojiler
- Solidity 0.8.20
- Hardhat + Ethers + Chai
- OpenZeppelin AccessControl
- Node.js + Express
- Sepolia test agi + Etherscan verify
- SSE tabanli canli dashboard

## Guvenlik Tasarimi
- Sadece `LOGGER_ROLE` sahibi adresler zincire yazabilir.
- `DEFAULT_ADMIN_ROLE` rol yonetimini yapar.
- Ayrik operasyon modeli uygulanmistir:
  - Deployer ve logger cuzdanlari ayrildi.
  - Deployer'dan LOGGER_ROLE kaldirildi.
- Zincire ham metin degil sadece hash yazilir.

## Gelistirilen Bilesenler
- Smart contract: contracts/LLMAuditLog.sol
- Deploy + verify scriptleri: scripts/deploy.js
- Role rotation scripti: scripts/rotate-logger-role.js
- Demo seed scripti: scripts/seed-demo-data.js
- Backend API: backend/logger-service.js
- Dashboard: backend/public/dashboard.html

## Canli Durum (Sepolia)
- Contract Address: 0x39af8B64f8CF45c5d1886aa8Ef90984f8f862452
- Verified Code: https://sepolia.etherscan.io/address/0x39af8B64f8CF45c5d1886aa8Ef90984f8f862452#code
- Role devri sonrasi ornek tx: 0xfb0da272800f21d40826c1c46cd18aa75a6d35abd7784be80aa2ae9867a9e8b8

## Demo Akisi (Kisa)
1. Backend calistirilir.
2. Dashboard acilir.
3. API uzerinden yeni log gonderilir.
4. Event satiri dashboarda anlik duser.
5. Etherscan ve on-chain okumayla kayit dogrulanir.

Detayli akis: docs/demo-senaryosu.md

## Sonuc
Proje; bilgi guvenligi bakis acisiyla denetlenebilirlik, degistirilemezlik ve gizlilik dengesini pratik bir mimariyle saglamistir. Ders projesi kapsaminda hem akademik hem uygulamali olarak guclu bir PoC seviyesine ulasilmistir.
