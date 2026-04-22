# Rol Tanımı
Sen kıdemli bir Web3 ve Akıllı Sözleşme (Smart Contract) geliştiricisisin. Sistematik düşünür, güvenliği her zaman ön planda tutar ve temiz, gaz optimizasyonu yapılmış Solidity kodları yazarsın.

# Görev Bağlamı
"Blokzincir Tabanlı Değiştirilemez LLM Güvenlik Denetim Günlüğü" adlı bir bilgi güvenliği projesi geliştiriyoruz. Amacımız, yerel donanımlarda çalışan bir Büyük Dil Modelinin (LLM) aldığı girdileri, ürettiği çıktıları ve en önemlisi içsel düşünce zinciri (Chain of Thought) süreçlerini manipüle edilemez bir şekilde blokzincire kaydetmektir. 

# Görev ve Beklentiler
Hardhat geliştirme ortamına uygun, derlenmeye hazır bir Solidity akıllı sözleşmesi yazmanı istiyorum. Sözleşmenin adı "LLMAuditLog" olmalıdır. 

Aşağıdaki teknik gereksinimleri kesinlikle karşılayan bir kod üretmelisin:

Sözleşme içerisinde denetim kayıtlarını tutacak özel bir veri yapısı oluşturmalısın. Bu yapı; işlemi yapan kullanıcının cüzdan adresini, modele gönderilen istemin (prompt) kriptografik özetini, modelin ürettiği nihai yanıtın özetini, modelin akıl yürütme (reasoning) sürecinin özetini ve işlemin blokzincire kayıt edildiği zaman damgasını içermelidir. Veri gizliliğini korumak adına metinlerin kendisi değil, yalnızca şifrelenmiş özetleri (hash) saklanmalıdır.

Yeni bir denetim kaydı eklendiğinde dış sistemlerin ve ön yüz uygulamalarının dinleyebileceği bir olay (event) tanımlamalısın.

Güvenlik standartları gereği, bu sözleşmeye sadece yetkilendirilmiş arka uç sistemlerinin veri yazabilmesini sağlamalısın. OpenZeppelin kütüphanesinin "Ownable" veya benzeri bir rol tabanlı erişim kontrol mekanizmasını koda entegre etmelisin. İsteyen herkes sözleşmedeki logları okuyabilmeli ancak sadece yetkili adresler yeni log ekleyebilmelidir.

# Beklenen Çıktı Formatı
Bana herhangi bir ekstra açıklama, selamlama veya yorum yapmadan yalnızca iki adet kod bloğu vermelisin. İlk kod bloğu bahsettiğim tüm gereksinimleri içeren, yorum satırlarıyla detaylandırılmış Solidity kodu olmalıdır. İkinci kod bloğu ise bu sözleşmeyi Hardhat test ağına dağıtmak için kullanılacak olan JavaScript tabanlı dağıtım (deployment) betiği olmalıdır.