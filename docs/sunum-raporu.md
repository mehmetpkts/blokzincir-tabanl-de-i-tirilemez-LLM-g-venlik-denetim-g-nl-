# Blokzincir Tabanli Degistirilemez LLM Guvenlik Denetim Gunlugu

## 1. Ozet
Bu rapor, LLM tabanli sistemlerde denetlenebilirlik ve butunluk problemini hedefleyen "Blokzincir Tabanli Degistirilemez LLM Guvenlik Denetim Gunlugu" projesinin teknik ve guvenlik acisindan degerlendirmesini sunar. Projede, LLM prompt, response ve reasoning icerikleri dogrudan saklanmamakta; yalnizca bu iceriklerin kriptografik hash degerleri blokzincire yazilmaktadir. Bu yaklasimla gizlilik korunurken, sonradan inkar edilemeyen ve manipule edilmesi zor bir audit izi elde edilmektedir.

Sistem, Solidity ile gelistirilmis bir akilli sozlesme, yetkili backend logger servisi, canli event izleme paneli ve test/deploy otomasyonundan olusur. Sepolia test aginda dagitim ve dogrulama (verify) basarili sekilde tamamlanmistir.

## 2. Problem Tanimi ve Motivasyon
LLM uygulamalarinda guvenlik incelemeleri sirasinda su kritik problemler ortaya cikmaktadir:

- Uretilen cevaplarin veya prompt girdilerinin sonradan degistirilmesi.
- Olay kayitlarinin silinmesi ya da inkar edilmesi.
- Merkezi log altyapisinda tek hata noktasi (single point of failure).
- Ham verinin saklanmasi durumunda gizlilik ve KVKK/GDPR benzeri uyum riskleri.

Bu nedenle proje, su soruya cevap verir:
"LLM islem kayitlari gizlilikten odun vermeden nasil degistirilemez ve denetlenebilir hale getirilir?"

## 3. Projenin Amaci
Projenin temel amaci, LLM islem akislarina ait kritik alanlari (prompt, response, reasoning) hashleyerek blokzincire kaydeden bir audit altyapisi olusturmaktir.

Alt hedefler:

- Yazma yetkisini yalnizca yetkili backend cuzdanlariyla sinirlamak.
- Okuma erisimini denetim ihtiyaclari icin herkese acik tutmak.
- Olay takibini event tabanli yapiyla gercek zamanli izlenebilir hale getirmek.
- Dagitim, test ve dogrulama surecini tekrar edilebilir kilmak.

## 4. Kapsam
### 4.1 Dahil Olanlar
- Akilli sozlesme ile append-only audit log saklama.
- Role-based access control (AccessControl) ile yazma yetkisi yonetimi.
- Tekli ve toplu kayit ekleme.
- Event yayinlama ve backend uzerinden canli izleme.
- Local ve Sepolia dagitim akislari.

### 4.2 Dahil Olmayanlar
- Ham LLM metninin on-chain saklanmasi.
- Ana ag (mainnet) uzerinde uretim ortami optimizasyonu.
- Kurumsal SIEM/SOC sistemleri ile tam entegre uretim mimarisi.

## 5. Teknik Mimari
Sistem bilesenleri asagidaki sekilde calisir:

1. LLM katmani prompt/response/reasoning metinlerini uretir.
2. Backend katmani bu metinleri keccak256 ile hashler.
3. Yetkili logger cuzdani akilli sozlesmeye yazim yapar.
4. Sozlesme AuditRecordAdded eventi yayimlar.
5. Dashboard SSE uzerinden eventleri canli izler.

Mimari referanslari:

- [Mimari Diyagram](./mimari-diyagram.md)
- [Demo Senaryosu](./demo-senaryosu.md)

## 6. Akilli Sozlesme Tasarimi
Sozlesme adi: `LLMAuditLog`

Temel veri modeli:

- actor: Islemi yapan adres
- promptHash: Prompt ozeti (bytes32)
- responseHash: Cevap ozeti (bytes32)
- reasoningHash: Akil yurutme ozeti (bytes32)
- timestamp: Kaydin zincire yazilma zamani

Kritik fonksiyonlar:

- addAuditRecord(...): Tek kayit ekleme
- addAuditRecordsBatch(...): Toplu kayit ekleme
- getRecordCount(): Toplam kayit sayisi
- getRecord(id): Tek kayit okuma
- getRecords(offset, limit): Sayfali okuma

Guvenlik kontrolleri:

- Yalnizca LOGGER_ROLE sahipleri yazabilir.
- ZeroAddress ve EmptyHash dogrulamalari vardir.
- Bos batch girisi engellenir.
- Kayit silme veya guncelleme fonksiyonu yoktur (append-only model).

## 7. Backend ve Entegrasyon Katmani
Backend servisi Express + Ethers tabanlidir.

Sunulan endpointler:

- POST /audit-log
- POST /audit-log/batch
- GET /health
- GET /events/recent
- GET /events/stream (SSE)

Is akisinda backend:

- Gelen metinleri hashler.
- Sozlesmeye islem gonderir.
- Islem sonucunu txHash ile geri dondurur.
- Eventleri bufferlayip dashboarda yayinlar.

## 8. Guvenlik Analizi
### 8.1 Guvenlik Kazanimlari
- Butunluk: Hash yapisi sayesinde veri degisikligi tespit edilebilir.
- Inkar edilemezlik: On-chain islem ve event izleri denetlenebilir.
- Erisim kontrolu: Yalnizca yetkili backend adresleri yazabilir.
- Gizlilik: Ham icerik yerine hash saklanir.

### 8.2 Tehditler ve Karsiliklar
- Yetkisiz yazim denemesi -> Role kontrolu ile engellenir.
- Yanlis/verisiz kayit -> Input validasyonlari ile engellenir.
- Tek cüzdan riski -> Logger role rotation ile azaltilir.
- Zincir disi veri sizmasi -> On-chain ham veri tutulmadigindan etki sinirlidir.

### 8.3 Operasyonel Guvenlik
- Deployer ve logger cuzdanlarinin ayrilmasi uygulanmistir.
- Logger rol devri script ile yonetilebilir.
- API key ile backend erisimi sinirlanabilir.

## 9. Test ve Dogrulama Sonuclari
Hardhat test suite kapsaminda asagidaki senaryolar dogrulanmistir:

- Constructor ile ilk logger rol atamasi.
- Sadece logger tarafindan kayit eklenebilmesi.
- Batch kayit ve event emisyonu.
- Kayit okuma ve sayfalama.
- Gecersiz girdilerde custom error davranisi.

Test sonucu: 6/6 basarili.

Ek dogrulamalar:

- Sepolia dagitimi tamamlandi.
- Etherscan source verify tamamlandi.
- Backend /health ve /audit-log akislari calisti.

## 10. Uretim Ortamina Gecis Icin Degerlendirme
PoC basarili olsa da, uretim ortami icin asagidaki iyilestirmeler onerilir:

- Multi-sig veya timelock tabanli admin yetki yonetimi.
- Merkeziyetsiz RPC/failover stratejisi.
- SIEM entegrasyonu ve uzun sureli zincir disi arsivleme.
- Key management icin HSM veya cloud KMS kullanimi.
- Rate limiting ve gelismis API kimlik dogrulama katmani.
- Formal verification veya gelismis denetim (audit) sureci.

## 11. Sinirliliklar
- Hash collisions pratikte cok dusuk olasiliklidir ancak teorik olarak sifir degildir.
- Hash tek basina anlamsal icerik sunmaz; dogrulama icin orijinal veri gerekir.
- Sepolia test agi, uretim agi guvencesini birebir temsil etmez.
- Event yakalama altyapisi RPC saglayiciya bagimlidir.

## 12. Sonuc
Proje, "Blokzincir Tabanli Degistirilemez LLM Guvenlik Denetim Gunlugu" basligini teknik olarak karsilamaktadir. Uygulanan mimari, gizlilik ve denetlenebilirlik dengesini koruyarak LLM guvenlik olaylarinin guvenilir sekilde kaydini saglamistir.

Akilli sozlesme, backend servis, canli dashboard, test altyapisi ve Sepolia dagitim/verify adimlariyla birlikte proje; ders sunumu icin olgun bir PoC seviyesine ulasmistir.

## 13. Ekler
### Ek-A: Baslica Komutlar

```bash
npm install
npm run compile
npm test
npm run precheck:sepolia
npm run deploy:sepolia
npm run start:backend
```

### Ek-B: Canli Referans Bilgileri
- Sepolia Contract Address: 0x39af8B64f8CF45c5d1886aa8Ef90984f8f862452
- Etherscan Verify: https://sepolia.etherscan.io/address/0x39af8B64f8CF45c5d1886aa8Ef90984f8f862452#code

### Ek-C: Sunumda Onerilen 10 Dakika Akisi
- 1 dk: Problem tanimi
- 1 dk: Mimari
- 2 dk: On-chain dogrulama
- 3 dk: Canli demo
- 2 dk: Butunluk kaniti
- 1 dk: Sonuc ve soru-cevap
