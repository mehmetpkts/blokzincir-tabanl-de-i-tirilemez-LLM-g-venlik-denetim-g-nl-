# Mimari Diyagram - Blokzincir Tabanli Degistirilemez LLM Guvenlik Denetim Gunlugu

```mermaid
flowchart LR
    U[Operator / Kullanici] --> A[LLM Uygulamasi]
    A --> B[Hash Katmani\nkeccak256(prompt,response,reasoning)]
    B --> C[Backend Logger API\nExpress + Ethers]
    C --> D[(LLMAuditLog Smart Contract\nSepolia)]

    D --> E[AuditRecordAdded Event]
    E --> F[Event Stream SSE]
    E --> G[On-chain Query API]

    F --> H[Canli Dashboard]
    G --> H

    I[Admin Deployer Cuzdan] -->|authorizeLogger/revokeLogger| D
    J[Ayrik Logger Cuzdan] -->|addAuditRecord/addAuditRecordsBatch| D

    K[Etherscan Verify] --- D
```

## Bilesenlerin Sorumluluklari

1. LLM Uygulamasi
- Prompt, response ve reasoning metinlerini uretir.
- Ham metni zincire gondermez.

2. Hash Katmani
- Her metni `keccak256(toUtf8Bytes(...))` ile hashler.
- Gizliligi korur, butunluk dogrulamasini mumkun kilar.

3. Backend Logger API
- Yetkili logger cuzdani ile zincire yazim yapar.
- `/audit-log` ve `/audit-log/batch` endpointleri sunar.

4. LLMAuditLog Sozlesmesi
- Sadece `LOGGER_ROLE` sahiplerine yazma izni verir.
- Her yazimda `AuditRecordAdded` eventi uretir.

5. Canli Dashboard
- `/events/stream` uzerinden SSE ile canli event alir.
- `/events/recent` ve `/health` endpointleriyle durumu gosterir.

6. Guvenlik Yonetimi
- Admin (deployer) logger rolunu devredebilir.
- Operasyonel guvenlik icin ayrik backend logger cuzdani kullanilir.
