# agentic-brain — Mimari Düzen ve Mühendislik Disiplini

> **Bu belge ne?** Projenin mimari düzeninin ve mühendislik disiplininin **nasıl
> kurulduğunun** kaydı. Hangi adım atıldı, hangi komut çalıştırıldı, ne çıktı, ne
> değişti — sırasıyla.
>
> **Bu belge Türkçe, çünkü insana anlatıyor.** Repo'nun sözleşme belgeleri
> (`PRODUCT.md`, `ARCHITECTURE.md`, `EVALS.md`, `docs/roadmap.md`,
> `docs/engineering-discipline.md`) Almanca ve **bağlayıcı** olan onlar. Bu belge onları
> anlatır, onların yerine geçmez. Çelişki olursa Almanca belge kazanır.
>
> **Buradaki her sayı çalıştırılmış bir komuttan geliyor.** Komut sayının yanında yazıyor.
> Ölçülmemiş hiçbir şey sayı olarak geçmez.
>
> **Son güncelleme:** 2026-09-10 · Etap 3c tamamlandı (Postgres adaptörü, K5 yeşil kaldı).
> Belgenin tamamı bu tarihe çekildi; §6.2 ile §6.4 bilinçli olarak **tarihsel kayıt**
> kalıyor ve E0-A gününü anlatıyor — o kaydın değeri, o gün ne yapıldığını göstermesi.

---

## 1. Proje bir bakışta

**agentic-brain** — **izin-duyarlı bir kurumsal bağlam katmanı** (permission-aware enterprise
context layer) ve üzerine oturan ajansal süreç otomasyonu. Bilgi, izinleriyle birlikte
alınır; izinlere sadık kalarak sorgulanır; ve **insan onayından geçmiş** eylemlere dönüşür.

Merkezî iddia tek cümle: _bir dosyanın var olması kanıt değildir; geçen bir kontrol komutu
kanıttır._

**Bugünkü durum:** altı katmanın hepsi dolu ve ölçülü; **hem chunk deposu hem embedding**
birer port ve her birinin iki adaptörü var (`memory`/`postgres`, `hash`/`voyage`). Ürün kararı
2026-09-10'da verildi (ADR-0010): **toplantı notu → aksiyon maddesi → ticket**, kaynak
paylaşımlı bir not sürücüsü. Açık kalanlar: **Voyage'a karşı gerçek koşu** (anahtar yok — ADR-0015'te
öngörü var, ölçüm yok) ve gerçek kimlik çözümü.

| Ne                     | Durum | Kanıt                                                               |
| ---------------------- | ----- | ------------------------------------------------------------------- |
| Uçtan uca akış         | 🟢    | `npm run demo` → `ZUGESTELLT` · `npm run demo:besprechung` → Exit 0 |
| Testler                | 🟢    | `npm test` → 179/179, kapsam %92,46                                 |
| Ölçüm (Schicht A)      | 🟢    | `npm run evals` → 28/28 + 32/32, iki geçiş özdeş                    |
| Yetkisiz erişim (3.13) | 🟢    | `npm run evals` → %0 (0/10 ve 0/16)                                 |
| Yetki geri alma (3.14) | 🟢    | `npm run evals` → %0 (0/6), **tek** senkron döngüsünde              |
| Çekirdek/alan ayrımı   | 🟢    | `grep -rn "besprechung" src/kernel/` → boş                          |
| Ürün tanımı            | 🟢    | ADR-0010 kontrol komutu → 0 şablon işareti                          |
| Lint zemini            | 🟡    | `npx eslint .` → 15 uyarı, 0 hata (baseline 12 idi — `themen.md`)   |
| Bağımlılık güvenliği   | 🟡    | `npm audit` → 0 high, 2 moderate (`qs`; `express` 5 gerekiyor)      |

### 1.1 Bu belgenin gerisinde kalan etaplar

| Etap | Ne oldu                                                               | Kanıt                                  |
| ---- | --------------------------------------------------------------------- | -------------------------------------- |
| 0c   | LangGraph 0.2.74 → 1.4.14; `npm audit` high: 0                        | Schicht A raporu satır satır özdeş     |
| 1    | QA kapısı `pruefer`; devrilme koruması ilk kez canlı yolda tetiklendi | `npm test` 107/107, `SS-1` vakası      |
| 2    | Bağlam ve retrieval katmanları; **3.13** metriği                      | 3.13 = %0, mutasyonda %37,5'e fırlıyor |
| 3a   | Dikey kararı (ADR-0010) + ontoloji; `PRODUCT.md` dolduruldu           | 0 şablon işareti                       |
| 3b   | Ebene ① connectors + `besprechung` alanı; **3.14** metriği            | 3.14 = %0, mutasyonda %83,3'e fırlıyor |

---

## 2. Dosya yapısı

Bugünkü gerçek ağaç. `★` ile işaretliler Etap 3b'de (2026-09-10) eklendi.

```
agentic-brain/
├── src/                              38 dosya, hepsi .js (ESM)
│   ├── kernel/                       MEKANİK — hiçbir alanı tanımaz
│   │   ├── connectors/         ★     ① kaynak portu + senkronizasyon döngüsü
│   │   ├── context/                  ② envelope · embedding portu · ingest · store portu
│   │   │   ├── store/postgres.js ★   pgvector · transaction · opt-in (ADR-0013)
│   │   │   └── embedding/        ★   index (port) · hash · voyage · zwischenspeicher
│   │   ├── retrieval/                ③ filter (saf ACL mantığı) · suche
│   │   ├── agent/                    ④ Agent Runtime: build · routing · runner ·
│   │   │                             schema · reducers · checkpointer
│   │   ├── action/                   ⑤ queue
│   │   ├── governance/               ⑥ guardrail · auth · rateLimiter ·
│   │   │                             trace · eventBus · costTracker
│   │   ├── config/env.js             altyapı — tüm ortam değişkenleri tek noktada
│   │   ├── llm/                      altyapı — adapter · mock
│   │   ├── persistence/              altyapı — store (iki katman birden kullanır)
│   │   └── registry.js               alan kaydı
│   ├── domains/beispiel/             ANLAM — referans alan (ADR-0004, kalıyor)
│   │   ├── domain.js                 dikiş: stateFields · brakes · nodes
│   │   ├── agents/                   bearbeiter · pruefer · ablage · zusteller
│   │   ├── prompts.js                tüm promptlar tek dosyada
│   │   └── actions.js                beyaz liste
│   ├── domains/besprechung/    ★     ANLAM — dikey (ADR-0010)
│   │   ├── domain.js                 8 fren; BREMSE5 alana özgü
│   │   ├── ontology.js               7 varlık · 14 ilişki · 3 aksiyon tipi
│   │   ├── acl.js                    kaynağın izin modeli → çekirdeğin envelope'u
│   │   ├── vertrag.js                çıktı sözleşmesi — LLM'siz, saf fonksiyon
│   │   ├── connectors/notizlaufwerk.js   not sürücüsü: miras · paylaşım · katılımcı
│   │   └── agents/                   extrahierer · pruefer · entwurf · ticketdienst
│   ├── adapters/http/server.js       dış temas
│   └── bin/                          demo · demo-besprechung ★ · serve
│
├── tests/                            node:test · npm test
├── evals/                            ölçüm aracı
│   ├── domains/<alan>/golden/        beklentiler (KURALDAN türetilir)
│   │                                 tasks · acl · entzug ★
│   ├── metrics/ · runners/           metrik tanımı · policy + messung
│   ├── reports/                      tarihli ölçüm raporları
│   └── traces/                       koşu başına bir JSONL
│
├── docs/
│   ├── workflow.md                   akış, düğüm sırası, HITL mekaniği
│   ├── security-model.md             dört katman, tehdit modeli
│   ├── development-process.md        AI destekli geliştirme, hafıza ritmi
│   ├── roadmap.md              ★     NE inşa edilecek — etaplar ve torlar
│   └── engineering-discipline.md ★   NASIL inşa edilecek — kurallar ve rollout
│
├── .gehirn/                          proje hafızası (SessionStart hook enjekte eder)
│   ├── kern.md                       kalıcı çıpa
│   ├── regeln.md                     bağlayıcı kurallar
│   ├── themen.md                     açık konular
│   └── letzte-sitzung.md             oturum köprüsü (git'e girmez)
│
├── .claude/                          hooks + skills + settings
├── data/                             kaynak metinler (analiz girdisi)
│
├── PRODUCT.md · ARCHITECTURE.md      sözleşme belgeleri
├── DECISIONS.md · EVALS.md · EXTEND.md
├── documentation.md            ★     bu belge
│
├── eslint.config.js            ★     lint kuralları
├── .prettierrc.json            ★     biçimlendirme
├── .prettierignore             ★
└── lefthook.yml                ★     pre-commit
```

### Yeni dosya nereye gider

**Her yeni dosya doğrudan hedef yerinde doğar.** Geçici bir ara depo yoktur — sonradan
taşınan dosya baseline karşılaştırmasını kırar.

- Mekanik → `src/kernel/`
- Anlam → `src/domains/<alan>/`
- Dış temas → `src/adapters/`

---

## 3. Mimari düzen

### 3.1 İki eksen, dik duruyorlar

Bu, projenin en pahalı kararı. İki farklı soru, iki farklı eksen:

**Yatay eksen — `kernel` / `domains`.** _"Anlamın sahibi kim?"_

- `src/kernel/` = **MEKANİK.** Graf nasıl kurulur, kuyruk nasıl çalışır, trace nasıl yazılır.
  Çekirdek **hiçbir tek alanı tanımaz.**
- `src/domains/<alan>/` = **ANLAM.** Hangi ajanlar var, frenler hangi sırayla devreye girer,
  hangi desenler tehdit sayılır, hangi aksiyonlar serbest.

**Dikey eksen — altı katman, üç motor.** _"IO'ya ne kadar uzak?"_ Her katman yatay eksenin
iki tarafını da keser. Katman adları ADR-0002 ile `src/kernel/` altındaki dizin adları oldu;
2026-09-10 itibarıyla **altısı da dolu**.

| Katman          | Motor         | `src/kernel/` tarafı — mekanik            | `src/domains/` tarafı — anlam      | Durum   |
| --------------- | ------------- | ----------------------------------------- | ---------------------------------- | ------- |
| ① Connectors    | 1 · Bağlam    | kaynak portu, senkronizasyon döngüsü      | hangi kaynak, hangi izin modeli    | 🟢 var  |
| ② Context Layer | 1 · Bağlam    | chunking, embedding, envelope kalıtımı    | ontoloji, varlık ve ilişki tipleri | 🟢 var  |
| ③ Retrieval     | 1 · Bağlam    | ACL filtresi, hibrit arama                | —                                  | 🟢 var  |
| ④ Agent Runtime | 2 · Ajan      | graph, routing yöntemi, state, checkpoint | ajanlar, promptlar, fren sırası    | 🟢 var  |
| ⑤ Action Layer  | 3 · Yönetişim | kuyruk mekaniği, idempotens, worker       | beyaz liste, doğrulayıcılar        | 🟢 var  |
| ⑥ Governance    | 3 · Yönetişim | guardrail, auth, rate limit, trace        | guardrail desenleri                | 🟡 yarı |

⑥'nın "yarı" olması policy engine ve audit zincirinin (Etap 4) henüz olmamasından.

**Hexagonal katmanlar (rand / saf mantık / use case / adapter) klasör değil, kuraldır.**
Modülün _içinde_ yaşarlar, `src/` altında kardeş dizin olarak değil:

```
kernel/connectors/index.js   · port          (bir kaynak ne yapabilmeli)
kernel/context/
  store/index.js             · port          (use case)
  store/memory.js            · adapter       (infrastructure)
kernel/retrieval/filter.js   · saf mantık    (IO görmez)
```

**Dikkat: `retrieval/` `context/`in altında değil, yanında.** Bir zamanlar iki belge bu
konuda çelişiyordu; ADR-0005 sözleşme lehine karara bağladı. Sebep mekanik: `ls src/kernel`
kontrolü bir katmanı eksik sayardı ve bu fark edilmezdi.

Bu ayrım `docs/engineering-discipline.md` §3'te karara bağlandı. Sebebi somut:
`src/domain/` ile `src/domains/` bir harf farkla iki ayrı anlam taşırdı, ve `src/agent/`
altında ikinci bir yürütücü, `human_approval`'da durmayan bir yol açardı.

### 3.2 Topoloji: hub-and-spoke

```
START → entry(guardrail) → hub(orchestrator) ⇄ {spokes}
                              ⛔ interruptBefore: human_approval
                              → (yalnız true ise) terminal → END
```

Zincir değil hub, çünkü yönlendirme zekâsı **tek** noktada oturur. Tek nokta = denetlenebilir.
Üreten her düğüm hub'a döner, hub yeniden karar verir.

`human_approval` **boş bir düğümdür.** Tek işlevi: grafın durduğu yeri işaretlemek.

### 3.3 Üç kademeli yönlendirme

1. **Deterministik frenler** — vakaların çoğunu **sıfır LLM maliyetiyle** çözer.
   Sıralamaları alanın ifadesidir.
2. **Yapılandırılmış çıktılı LLM** — yalnızca hiçbir fren tutmazsa.
3. **LLM sonrası doğrulama** — enum dışı bir ajan ⇒ güvenli `END` override'ı.

**HITL kararı asla LLM'e bırakılmaz.** Fren 2'de, her veri mantığından önce durur.

### 3.4 Dikişin altı noktası

Alan, çekirdeğe tam altı yerden dokunur. İlk dördü iskeletle birlikte vardı; son ikisi
Etap 2 ve 3b ile geldi. Her satırda çekirdek **mekaniği**, alan **anlamı** verir.

| Yer             | Çekirdek verir                     | Alan verir                        |
| --------------- | ---------------------------------- | --------------------------------- |
| Routing         | `createRouter` (yöntem)            | frenler, sırasıyla                |
| Guardrail       | `createGuardrail` (regex motoru)   | desenler ve ağırlıkları           |
| Aksiyon kuyruğu | `createActionQueue` (mekanik)      | beyaz liste ve doğrulayıcılar     |
| State           | çekirdek alanlar + `buildState`    | kendi alanları ve reducer seçimi  |
| Chunk deposu    | `createStore` (port) + `baueStore` | — (mekanik; alan burada konuşmaz) |
| Connector       | `createConnector` (port)           | kaynağın izin modeli → envelope   |

Sonuncusu en pahalısı ve en çok anlam taşıyanı: bir connector'ın onda biri "getirme",
onda dokuzu **izin toplama**. O dokuz `src/domains/<alan>/acl.js`'te yaşıyor, çekirdekte
değil. Çekirdek yalnız biçimi tarif eder — envelope'u zaten toplanmış, eksiksiz bir anlık
görüntü.

**Sınama kriteri:** ikinci bir alan `src/kernel/` altında **sıfır satır** değiştirir. Bu
artık bir söz değil, ölçülmüş bir olgu — `besprechung` gerçekten ikinci bir alan olarak
doğdu ve çekirdek hiç değişmedi.

```bash
grep -rn "beispiel" src/kernel/       # boş kalmalı → bugün 0 ✓
grep -rn "besprechung" src/kernel/    # boş kalmalı → bugün 0 ✓
```

### 3.5 Bağlam zinciri: kaynaktan cevaba

Etap 2 ve 3b ile gelen zincir. Her halkanın tek bir işi var, ve zincirin güvencesi
halkaların **sırasında** duruyor:

```
Kaynak (not sürücüsü)
  │  connector.hole()          → eksiksiz ANLIK GÖRÜNTÜ (delta değil)
  ▼
acl.js                         → kaynağın izin modeli ➜ envelope
  │                              klasör mirası · tek kişiye paylaşım · katılımcı listesi
  ▼
ingest/pipeline.js             → chunk'lar; envelope HER chunk'a kalıtılır
  ▼
store.ersetzeQuelle(quelle, …) → kaynağın tamamı ATOMİK olarak değişir
  ▼
retrieval/filter.js            → principal ➜ yüklem (predicate)
  ▼
store.suche(principal, …)      → yüklem aramanın İÇİNDE; yetkisiz chunk hiç puanlanmaz
```

Üç tasarım kararı bu zinciri taşıyor, üçü de ADR:

- **ADR-0008 — filtre sorguya derlenir.** Yetkisiz chunk depodan çıkıp sonra atılmaz;
  hiç çıkmaz. Principal çözülemezse sonuç **boş**, filtresiz değil.
- **ADR-0009 — envelope her chunk'a kalıtılır.** Belgede tutulup arama sırasında bakılsaydı
  bu bir join olurdu, ve join unutulabilir. Bedeli: izin değişince tüm chunk'lar
  yenilenmeli — 3.14 tam bunu ölçüyor.
- **ADR-0014 — ACL kuralları tek kaynak, iki derleme.** `memory` bir JavaScript yüklemine,
  Postgres bir SQL `WHERE`'ine ihtiyaç duyar. İki ayrı uygulama sessizce ayrışır ve 3.13 her
  adaptörde yalnız kendi yarısını ölçer — ikisi de %0 der, farklı şeyler kastederek. Bu
  yüzden her kural iki derlemesini **yan yana** taşır, ve aynı anlama geldikleri ölçülür:
  bir differenztest ve aynı eval paketinin iki adaptöre karşı koşması.
- **ADR-0011 — anlık görüntü, delta değil.** Delta'da yetki geri alma, delta'nın
  doğruluğuna asılı kalır; oysa kaynakların en çok sustuğu şey tam da geri almadır.
  Atomik değiştirmede güvence **yapısal**: anlık görüntüde olmayan belge yok olur, çünkü
  artık yok — biri silme olayını doğru işlediği için değil.

---

## 4. Güvenlik

### 4.1 Altı katman, isteğin geçtiği sırayla

| #   | Katman             | Dosya                                      | Ne yapar                                                                           | Bilinen sınırı                                                             |
| --- | ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Guardrail          | `governance/guardrail.js`                  | **LLM'siz** ağırlıklı regex, üç bant: ≥3 blok · 2 sanitize · 1 geçir ama raporla   | Regex yalnız bilinen biçimi tanır. Dış veri de düşmandır                   |
| 2   | Bütçe kill-switch  | `governance/costTracker.js`                | Bütçe aşıldıysa koşu **guardrail'de** biter — ilk LLM çağrısından önce             | Mock modunda token tahmini kaba (karakter ÷ 4)                             |
| 3   | Auth + rate limit  | `governance/auth.js`, `rateLimiter.js`     | Anahtar **doğrulanır, bereinigt edilmez**; sabit-zamanlı karşılaştırma; üç limiter | SSE ucu auth'un **önünde** — koruma tahmin edilemez `threadId`             |
| 4   | Aksiyon izolasyonu | `action/queue.js` + `domains/*/actions.js` | `Ajan → Kuyruk (sadece YAZAR) → Worker (okur + DOĞRULAR + çalıştırır)`             | Worker simüle ediyor; gerçek çağrı sert timeout ister                      |
| 5   | ACL filtresi       | `retrieval/filter.js` + `context/store/`   | Filtre **sorguya derlenir**; yetkisiz chunk depoyu hiç terk etmez (ADR-0008)       | `principal` Etap 4'e kadar çağıranın **iddiası**, doğrulanmış kimlik değil |
| 6   | Yetki geri alma    | `connectors/synchronisation.js`            | Anlık görüntü kaynağı **atomik** değiştirir; geri alma tek döngüde yayılır         | Döngüyü kimse zamanlamıyor — "N saniye" değil, "bir döngü"                 |

Katman 5 ve 6 Etap 2 ve 3b ile geldi. İkisi de **ölçülüyor**: 3.13 ve 3.14. Ölçülmeyen bir
güvenlik katmanı bir iddiadır.

**Neden guardrail'de LLM yok:** güvenlik denetiminin kendisi prompt injection'a bağışık
olmalı. Bir modele _"bu metin tehlikeli mi?"_ diye sorarsan, saldıran kişi o modeli de
kandırabilir.

**Üçüncü bant bilinçli:** saldırı kelimeleri meşru bir konu olabilir. Bloklarsan yakalama
oranını yanlış pozitifle satın alırsın — metrik 3.5 iki tarafı da ölçer.

### 4.2 Üstündeki zapt: Human-in-the-Loop

Altı katmanın hepsi, graf onay kapısını atlarsa değersizdir. Bu yüzden zapt
**çekirdekte**, bir
alanda değil:

- `humanApproval` bir **çekirdek alandır**. Alan onu ezemez — `buildState` fırlatır.
- `human_approval → terminal` kenarı **tam `true`** kontrol eder. `false`, `null`,
  `undefined` → `END`.
- `interruptBefore` grafı düğüme **girmeden önce** durdurur.

Sınanıyor: `tests/workflow.test.js` ve `tests/integration/persistence.test.js` — ikincisi
gerçek bir süreç sınırı üzerinden, PID karşılaştırmalı.

### 4.3 Tehdit modeli

**Koruduğu:** kullanıcı girdisi üzerinden prompt injection · kaçırılmış veya halüsinasyon
gören ajan · sınırsız tüketim · **insan onayı olmadan dış dünyada etki**.

**Bilerek korumadığı:** dosya sistemine erişimi olan kötü niyetli işletmeci · sağlayıcıda
ele geçirilmiş model · uygulama katmanının altındaki ağ saldırıları · aynı state dizinine
eşzamanlı yazan birden çok süreç.

### 4.4 🟡 Bağımlılık zafiyetleri — 2026-09-10 durumu

```bash
npm audit          # 0 high, 2 moderate, 0 critical
```

2026-09-08'de 11 zafiyet vardı, altısı **high**. En ağırı `@langchain/core` zincirindeki
_"serialization injection — secret extraction"_ idi. Etap 0c bunu ADR-0003 ile kapattı:
`@langchain/langgraph` 0.2.74 → **1.4.14**, `@langchain/core` → 1.2.9,
`@langchain/anthropic` → 1.5.9, `zod` → 3.25.76 (1.x'in peer koşulu; v3'te kalıyor).

Geriye **iki orta** kaldı, ikisi de aynı yerden:

| Kaynak           | Seviye   | Açıklama                 | Ne gerekiyor                  |
| ---------------- | -------- | ------------------------ | ----------------------------- |
| `express` → `qs` | moderate | array-limit bypass       | `express` 5 — major, ayrı ADR |
| `express` → `qs` | moderate | `isBuffer` üzerinden DoS | aynısı                        |

`npm audit fix --force` **çalıştırılmadı** ve çalıştırılmayacak: major sürüm atlar,
`src/adapters/http/` etkilenir ve bu ADR-0003'ün kapsamı değil. Kendi kararını bekliyor —
`.gehirn/themen.md`'de açık konu olarak duruyor.

**Etap 0c'nin öğrettiği şey:** 98 test ağ görevi gördü. Kaynak kodda tek bir kırılma noktası
çıktı ve ADR'nin tahmin ettiği yer değildi — state şeması değil, checkpointer'daki
`serde.dumpsTyped`, 1.x'te **asenkron** olmuştu. 0.2.74 ile yazılmış 88 checkpoint hatasız
geri oynadı: geçiş durum-uyumluydu.

---

## 5. Testler ve ölçüm

### 5.1 İki ayrı şey

**Testler** mekanizmanın doğruluğunu sınar. **Ölçüm (evals)** politikanın uygulanıp
uygulanmadığını sayıyla söyler. İkisi karıştırılmaz.

### 5.2 Testler

```bash
npm test
```

`node:test` · `--experimental-test-coverage` · alt sınır %80.

| Ölçüm             | Değer                            | Tarih      |
| ----------------- | -------------------------------- | ---------- |
| Testler           | **179 / 179 geçti**, 0 başarısız | 2026-09-10 |
| Satır kapsamı     | **%92,46** (sınır %80)           | 2026-09-10 |
| Dal kapsamı       | %90,97                           | 2026-09-10 |
| Fonksiyon kapsamı | %91,93                           | 2026-09-10 |

Kapsamdan hariç tutulanlar: `tests/**`, `src/adapters/http/server.js`, `src/bin/*.js`.

Test sayısının seyri, her etabın ne kadar yeni yüzey açtığını gösteriyor:
98 (iskelet) → 107 (QA kapısı) → 138 (bağlam + retrieval) → **179** (connector + dikey).

İki test dosyası bu etapta doğdu ve ikisi de bir ADR'nin kontrol komutu:

| Dosya                       | Ne sınar                                                            | Kaç |
| --------------------------- | ------------------------------------------------------------------- | --- |
| `tests/connectors.test.js`  | port, senkronizasyon, atomik değiştirme (ADR-0011)                  | 11  |
| `tests/besprechung.test.js` | ontoloji, ACL çevirisi, connector, çıktı sözleşmesi (ADR-0010/0012) | 24  |

### 5.3 Ölçüm: iki katman

**Schicht A — mock modunda, deterministik, bedava, CI'da çalışır.** Model çıktısının
_kalitesini_ ölçmez; **routing ve politikaların doğruluğunu** ölçer.

**Schicht B — gerçek modele karşı, çıktı sözleşmesi olarak.** Ölçüm döngüsü
(`evals/runners/messung.js`) anahtarsız sınanmış durumda ve **çıktı sözleşmesi artık var**:
`src/domains/besprechung/vertrag.js` — LLM'siz, saf fonksiyon, `{ istFreigegeben, gruende }`
döndürüyor. Eksik olan tek parça gerçek modeli çağıran runner. Sözleşmenin LLM'siz olması
şart: kendisi de bir modele soran bir denetçi, iki bilinmeyeni birbirine karşı ölçer.

```bash
npm run evals                    # iki alan da
npm run evals -- besprechung     # yalnız biri (geliştirme içindir)
```

**2026-09-10 koşusu — iki alan.** `beispiel` iskeletin referans alanı (ADR-0004, kalıyor),
`besprechung` dikey (ADR-0010).

| Metrik                        | Hedef   | `beispiel` (22 görev)             | `besprechung` (19 görev)      |
| ----------------------------- | ------- | --------------------------------- | ----------------------------- |
| 3.1 Approval-Enforcement-Rate | %100    | **%100,0** (3/3)                  | **%100,0** (2/2)              |
| 3.2 Unauthorized-Action-Rate  | %0      | **%0,0** (0/3)                    | **%0,0** (0/2)                |
| 3.3 Loop-Termination-Rate     | %100    | **%100,0** (19/19)                | **%100,0** (15/15)            |
| 3.4 Routing determinizmi      | %100    | **%100,0** (19/19)                | **%100,0** (15/15)            |
| 3.5 Guardrail P / R           | raporla | P %100 · R %100 (TP 3 · FP 0)     | P %100 · R %100 (TP 3 · FP 0) |
| 3.6 Koşu başına maliyet       | raporla | medyan 0,001884 USD (19)          | medyan 0,001920 USD (15)      |
| 3.12 Bağlam büyümesi          | raporla | medyan ×2,79 · tepe 101 token     | medyan ×2,12 · tepe 172 token |
| **3.13 Yetkisiz erişim**      | %0      | **%0,0** (0/10)                   | **%0,0** (0/16)               |
| **3.14 Yetki geri alma**      | %0      | ölçülemez (0/0) — connector'ı yok | **%0,0** (0/6), **1 döngü**   |
| Sözleşme uyumu                | —       | **28/28**                         | **32/32**                     |
| Determinizm (iki geçiş)       | özdeş   | 🟢 özdeş                          | 🟢 özdeş                      |

Raporlar: `evals/reports/2026-09-10-schicht-a-beispiel-memory-hash.json` ve
`2026-09-10-schicht-a-besprechung-memory-hash.json` — ikisi de `.gitignore`'dan bilinçli
olarak muaf, `PRODUCT.md` §6 onlara dayanıyor. Adı `evals/runners/policy.js:567` kuruyor:
`<tarih>-schicht-a-<alan>-<STORE_ADAPTER>-<EMBEDDING_ADAPTER>.json`. Postgres koşusunun
**raporu yok** — şemaya göre `…-besprechung-postgres-hash.json` olurdu, ama koşu hiç
yapılmadı; bu yüzden `.gitignore`'da da satırı yok. 2026-09-16'da ölçüldü.

**`beispiel` satırındaki tek önemli şey, hiçbir sayının kıpırdamamış olması.** 2026-09-09
koşusuyla metrik metrik özdeş. `docs/roadmap.md` §6 bu etaptan tam olarak bunu istiyordu:
yeni katman eski güvenceleri oynatmamalı.

**3.14'ün "ölçülemez" demesi bir kusur değil, paydanın sıfır olması.** `beispiel`'in
connector'ı yok, dolayısıyla geri alınabilecek bir izni de yok. Metrik %0 deseydi ölçülmemiş
bir şey yeşil görünürdü — payda probunun bütün amacı bu.

### 5.3.1 Sayı kırmızıya dönebiliyor mu? Mutasyon probu

Kırmızıya hiç dönmeyen bir test hiçbir şey ölçmez. Bu yüzden iki güvence bilerek kırıldı ve
sonra geri alındı:

| Ne kırıldı                                    | Beklenen     | Gerçekleşen                                      |
| --------------------------------------------- | ------------ | ------------------------------------------------ |
| `filter.js`'ten mandant kontrolü çıkarıldı    | 3.13 kırmızı | **%37,5** · 5 vaka sızıntısını isimle bildirdi   |
| `ersetzeQuelle` ekleme yapar hale getirildi   | 3.14 kırmızı | **%83,3** (5/6) · 7 bayat chunk · çıkış kodu 1   |
| `ersetzeQuelle` her şeyi siler hale getirildi | yakalanmalı  | 3.14 **%0 kaldı** — Vertragstreue 26/32'ye düştü |

Üçüncüsü en öğreticisi: metrik kusursuz görünürken depo hiçbir şey döndürmüyordu. Onu
yakalayan metrik değil, **sözleşme uyumu** oldu — her geri alma vakası `vorher` ve `nachher`
durumunu ayrı ayrı beyan ediyor, ve `EZ-6` vakası bilerek "hiçbir şey değişmemeli" diyor.
Bir metriğin ters yönü ölçülmüyorsa, metrik yarımdır.

### 5.4 Golden veri kuralı

**Bir beklenti KURALDAN türetilir, gözlenen bir koşuya asla uydurulmaz.** Kural değişirse
beklenti **yeniden türetilir**. Beklentiyi sonuca uyduran, ölçümü ortadan kaldırır — ve
her şey yeşil kaldığı için bunu hiçbir yerden fark etmez.

Bu yüzden **sentetik golden veri üretilmez.** Bu karar hem `.gehirn/regeln.md` hem de
analiz edilen kaynak metnin kendi §10.2'siyle uyumludur.

### 5.5 Başarı kriterleri

| #   | Kriter                                                 | Kontrol komutu                       | Durum |
| --- | ------------------------------------------------------ | ------------------------------------ | ----- |
| K1  | Akış her dış etkiden önce insanda durur                | `npm test`                           | 🟢    |
| K2  | Ret hiçbir şey teslim etmez, hiçbir şey kuyruğa koymaz | `npm test`                           | 🟢    |
| K3  | Yeniden başlatma bekleyen onayı kaybetmez              | `npm test` (integration)             | 🟢    |
| K4  | Routing deterministik ve sonlanıyor                    | `npm run evals`                      | 🟢    |
| K5  | `clone → install → demo` taze makinede geçer           | `npm install && npm run demo`        | 🟢    |
| K6  | İkinci alan çekirdekte sıfır satır değiştirir          | `grep -rn "besprechung" src/kernel/` | 🟢    |
| K7  | Yetkisiz hiçbir chunk depoyu terk etmez                | `npm run evals` → 3.13 = %0          | 🟢    |
| K8  | Kaynaktaki geri alma bir döngüde yayılır               | `npm run evals` → 3.14 = %0          | 🟢    |
| K9  | Modellenmemiş hiçbir aksiyon tipi serbest değil        | `npm test` (`besprechung.test.js`)   | 🟢    |

K6 artık kendi kendine verilmiş bir söz değil: `besprechung` gerçek bir ikinci alan ve komut
onu sınıyor. `beispiel` bilerek duruyor (ADR-0004) — yalnız böyle söz gerçekten sınanır.

Sözleşme metni `PRODUCT.md` §4'te; buradaki tablo onun Türkçe karşılığıdır, yerine geçmez.

---

## 6. Mühendislik disiplini — nasıl kuruldu

### 6.1 Neden gerekti

Repo'da on bir yazılı kural vardı (`.gehirn/regeln.md`) ama **hiçbirini bir komut
zorlamıyordu.** Prosa okunur — biri hatırlarsa. Ölçüm bunu gösterdi:

```bash
ls | grep -iE "eslint|prettier|lefthook|tsconfig"    # (hiçbiri)
node -e "console.log(require('./package.json').devDependencies)"   # (yok)
```

Sıfır lint, sıfır formatter, sıfır hook, sıfır tip kontrolü, sıfır devDependency.

Yönlendirici cümle: **bir komutun kontrol etmediği kural, bir görüştür.**

### 6.2 Etap E0-A — atılan adımlar, sırasıyla

> **Bu bölüm bilinçli olarak tarihsel kayıttır** (2026-09-08). Değeri, o gün hangi adımın
> hangi sırayla atıldığını ve **hangi ilk hükmün yanlış çıktığını** göstermesi. Güncel lint
> durumu §6.3'ün sonunda.

**Adım 1 — Kararlar soruldu, varsayılmadı.** Paket kapsamı, hook mekanizması, Prettier'ın
mevcut koda uygulanıp uygulanmayacağı ve bu belgenin dili kullanıcıya soruldu. Global kural
gereği yeni bağımlılık onaysız eklenmez.

**Adım 2 — Sürümler doğrulandı.** Ezberden yazılmadı:

```bash
npm view eslint version          # 10.10.0
npm view prettier version        # 3.9.6
npm view lefthook version        # 2.1.12
```

**Adım 3 — Beş paket kuruldu, sürümler tam sabit (caret değil).**

```bash
npm install --save-dev --save-exact \
  eslint@10.10.0 @eslint/js@10.0.1 globals@17.12.0 prettier@3.9.6 lefthook@2.1.12
```

Sabit pin kasıtlı: bir minor bump yeni kural getirip lint baseline'ını sessizce kaydırır,
o da ölçümü bozar.

**Adım 4 — `npm audit` incelendi.** 11 zafiyet çıktı; hepsinin **mevcut üretim
bağımlılıklarından** geldiği doğrulandı (§4.4). Otomatik düzeltme çalıştırılmadı.

**Adım 5 — Config dosyaları yazıldı.**

| Dosya              | Ne yapar                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.js` | ESLint 10 flat config. `js.configs.recommended` **tümüyle `warn`'a indirildi** — E0-A'da hiçbir şey blokelemez                        |
| `.prettierrc.json` | Mevcut kod stiline birebir uyar: 80 sütun, 2 boşluk, çift tırnak, noktalı virgül, trailing comma                                      |
| `.prettierignore`  | `.gitignore` ile aynı erzeugte dizinler + `data/`                                                                                     |
| `lefthook.yml`     | pre-commit: prettier `--write` + `stage_fixed`, eslint. Toplu biçimlendirme **yok** — her dosya bir sonraki düzenlemesinde biçimlenir |

`alsWarnung()` yardımcı fonksiyonu bilinçli: E0-A'nın tek amacı **bestandı görmek**, hata
düzeltmek değil. Bir kuralı hemen `error` yapmak toplu düzeltme dayatır — ve o an hangi
değişikliğin hangi sayıyı oynattığı ölçülemez hale gelir.

**Adım 6 — Hook kuruldu.**

```bash
npx lefthook install     # sync hooks: ✔️ (pre-commit)
```

**Adım 7 — İlk baseline alındı → 36 uyarı. Ve incelendi.**

Burada iki şey ayrıştı, ve bu ayrım atlanmış olsaydı 24 sahte bulgu raporlanacaktı:

- **9 uyarı benim config hatamdı.** `tests/fixtures/*.mjs` dosyaları `files: ["**/*.js"]`
  kalıbına uymuyordu, dolayısıyla Node global'lerini almıyor ve `process` tanımsız
  sayılıyordu. Kalıp `["**/*.js", "**/*.mjs", "**/*.cjs"]` olarak düzeltildi.
- **15 uyarı kuralın yanlış kapsamıydı.** `no-restricted-syntax` testlerde ve ölçüm
  harness'ında da tetikleniyordu. Oysa `env.js` kendi yorumunda bunu **açıkça isteyerek**
  yazıyor: testler ve harness `STATE_DIR`/`TRACE_DIR` ile taze bir dizine gösterir, yoksa
  bir koşu bir öncekini sürükler ve determinizm kanıtı kanıt olmaktan çıkar. Kural
  `src/**` ile sınırlandı.

**Adım 8 — B1 bulgusu düzeltildi.** İlk raporda `src/` içindeki üç `process.env` yeri
"konvansiyon çürümesi" olarak nitelenmişti. Kod okununca hüküm değişti: üçü de **belgelenmiş
ve kasıtlı geç bağlama**. Gerçek kusur daha ince — değişken adı iki dosyada yaşıyor
(`STATE_DIR` hem `env.js`'de hem `store.js`'de), ve `TRACE_DIR` `env.js`'de yalnızca bir
yorumda geçiyor. E0-C'nin işi bu yüzden "kaçakları taşımak" değil, `env.js`'e **geç bağlamalı
erişimciler** koymak.

**Adım 9 — Düzeltilmiş baseline: 12 uyarı, 0 hata, çıkış kodu 0.**

### 6.3 Lint baseline — 2026-09-08

```bash
npx eslint .        # ✖ 12 problems (0 errors, 12 warnings) · exit 0
```

| Kural                    | Adet | Nerede                                                                        |
| ------------------------ | ---- | ----------------------------------------------------------------------------- |
| `no-restricted-syntax`   | 3    | `src/kernel/governance/trace.js:31` · `src/kernel/persistence/store.js:34,38` |
| `no-unused-vars`         | 3    | `tests/schichtB.test.js:17,18,19` (`fs`, `os`, `path` — kullanılmayan import) |
| `max-lines-per-function` | 3    | `src/kernel/action/queue.js:57` (`createActionQueue`, 101 satır) + evals'de 2 |
| `complexity`             | 2    | `evals/`                                                                      |
| `max-depth`              | 1    | `src/kernel/agent/checkpointer.js:78` (iç içe 5, sınır 4)                     |

**Dizin dağılımı:** `src/` 5 · `evals/` 4 · `tests/` 3.

Hiçbiri hata değil. Hiçbiri commit'i engellemiyor. Bu bilinçli — bestand önce görünür olur,
sonra kaldırılır.

#### Baseline'ın seyri — ve 2026-09-10'daki üç yeni uyarı

Etap 0c, 1 ve 2 boyunca sayı **12'de sabit kaldı**; her etap raporunda bu ayrıca doğrulandı.
Etap 3b ilk kez oynattı:

```bash
npx eslint .        # ✖ 15 problems (0 errors, 15 warnings) · exit 0
```

Üç yeni uyarının üçü de değişikliğin doğrudan bedeli, ve üçü de **bilerek** duruyor:

| Yeni uyarı                      | Nereden geldi                                     | Neden düzeltilmedi                                                           |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `darfSehen` karmaşıklık 11      | ADR-0012'nin eklediği tek kural (kişiye paylaşım) | Sıralı kural listesini bölmek onu okunmaz yapar — **sıra, iddianın kendisi** |
| `pruefeEnvelope` karmaşıklık 13 | opsiyonel `erlaubtePersonen` doğrulaması          | Aynı sebep; doğrulama tek yerde kalmalı                                      |
| `berechneMetriken` 104 satır    | bir metrik daha (3.14)                            | Liste bilerek düz; bölmek "metrikler tek yerde" kuralını kırar               |

ADR-0012 bu bedeli kendi **Konsequenzen** bölümünde önceden yazmıştı: _"Filtrenin bir kuralı
daha var, ve her kural yanlış olabileceği bir yerdir."_ Bedelin ödendiği yer burası.

Karar açık: eşikler bu dosyalar için mi yükseltilecek, yoksa bulgular bilinen istisna olarak
mı yazılacak? İkisi de `docs/engineering-discipline.md`'ye ait — sessiz bir ayarlama değil.
`.gehirn/themen.md`'de açık konu.

### 6.4 E0-A torı — dördü de geçti (2026-09-08)

| Kontrol                   | Beklenen          | Sonuç                                       |
| ------------------------- | ----------------- | ------------------------------------------- |
| `git status --short src/` | değişiklik yok    | 🟢 `src/` dokunulmadı                       |
| `npm test`                | baseline ile aynı | 🟢 98/98 · %90,53 — özdeş                   |
| `npm run evals`           | baseline ile aynı | 🟢 tüm metrikler özdeş, determinizm 🟢      |
| `npm run demo`            | uçtan uca geçer   | 🟢 `human_approval`'da durdu → `ZUGESTELLT` |

**Disiplini kurmak ölçümü oynatmadı.** Zaten şartı buydu: oynatsaydı hatalı olan kod değil,
kural olurdu.

### 6.5 Aynı tor, sonraki etaplarda

Aynı çekirdek tor her etapta koşturuldu. Sayılar değişti, kural değişmedi:

| Etap | `npm test`  | Schicht A                            | Ek koşul                        |
| ---- | ----------- | ------------------------------------ | ------------------------------- |
| 0b   | 98/98       | rapor **bayt bayt** özdeş            | saf yeniden adlandırma          |
| 0c   | 98/98       | rapor **satır satır** özdeş          | `npm audit` high: 0             |
| 1    | 107/107     | 22/22 · dört söz metriği kıpırdamadı | `RV-1` → `bearbeiterAufrufe: 2` |
| 2    | 138/138     | 28/28 · **3.13 = %0**                | K5 yeşil, çizgi boş             |
| 3b   | **179/179** | 28/28 + 32/32 · **3.14 = %0**        | 3.13 ve 3.1–3.4 kıpırdamadı     |
| 3d   | **211/217** | 28/28 + 32/32 · her metrik aynı      | hiçbir sayı kıpırdamadı         |

Değişmeyen kural: **bir etap en fazla bir yeni metrik getirir.** Aksi halde bir sayı
oynadığında hangi değişikliğin oynattığı ayırt edilemez. Etap 3'ün 3a–3d'ye bölünmesi bunun
tersten okunuşu: connector, Postgres ve gerçek embedding üçü de **aynı** güvenceye (3.13)
dokunuyor.

---

## 7. Bulgu defteri

Her bulgunun onu bulan komutu var. Düzeltilenler açıkça işaretli. **Kapanan bir bulgu
silinmez, üstü çizilir** — hangi sorunun ne zaman ve neyle kapandığı, sorunun kendisi kadar
değerli.

| #   | Bulgu                                                                                                                                                                                                      | Komut                                               | Durum                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------- |
| B1  | `src/` içinde 3 `process.env` yeri. ~~Konvansiyon çürümesi~~ → **düzeltildi:** üçü de kasıtlı geç bağlama; asıl kusur değişken adının iki yerde yaşaması                                                   | `npx eslint .`                                      | 🟠 E0-C                     |
| B2  | `zod` 27 dosyadan 1'inde. HTTP sınırı parse edilmiyor                                                                                                                                                      | `grep -rln "from \"zod\"" src/`                     | 🟠 E0-E                     |
| B3  | Lint/formatter/hook/tip kontrolü yok, sıfır devDependency                                                                                                                                                  | `ls \| grep -iE "eslint\|prettier"`                 | 🟢 **E0-A'da kapandı**      |
| B4  | ~~`@langchain/langgraph` 0.2.74~~ → **1.4.14**, `@langchain/core` 1.2.9, `@langchain/anthropic` 1.5.9                                                                                                      | `npm view @langchain/langgraph version`             | 🟢 **Etappe 0c'de kapandı** |
| B5  | Çekirdek/alan çizgisi sağlam                                                                                                                                                                               | `grep -rn "beispiel" src/kernel/` → 0               | 🟢                          |
| B6  | ~~`PRODUCT.md` 9 şablon markası taşıyor~~ → **0**; §1–§7 dolu, dikey karara bağlandı (ADR-0010)                                                                                                            | ADR-0010'un kontrol komutu → 0                      | 🟢 **Etap 3a'da kapandı**   |
| B7  | ~~11 zafiyet (6 high)~~ → `high: 0`. Geriye `express` 4.x'in getirdiği 2 orta kaldı; onlar `express` 5 gerektiriyor, ayrı karar                                                                            | `npm audit`                                         | 🟢 **Etappe 0c'de kapandı** |
| B8  | `tests/schichtB.test.js` üç kullanılmayan import taşıyor — Schicht B'nin henüz iskelet olduğunun izi                                                                                                       | `npx eslint .`                                      | ⚪ küçük                    |
| B9  | Lint baseline 12 → **15**. Üçü de Etap 3b'nin bedeli, bilerek duruyor (§6.3). Eşik mi yükselsin, istisna mı yazılsın — karar bekliyor                                                                      | `npx eslint .`                                      | 🟡 karar bekliyor           |
| B10 | ⑥ Governance yarım: policy engine ve audit hash zinciri yok. Onay timeout'u (3.15) ölçülmüyor                                                                                                              | `ls src/kernel/governance/`                         | 🟠 Etap 4                   |
| B11 | ~~Chunk deposunun tek adaptörü var~~ → **iki**. Port kanıtlandı: aynı paket iki adaptörde aynı sayıyı veriyor                                                                                              | `npm run evals:postgres`                            | 🟢 **Etap 3c'de kapandı**   |
| B12 | ~~Embedding bir hash'ten geliyor~~ → hash artık **varsayılan adaptör**, tek seçenek değil (ADR-0015). Yine de 3.13 hâlâ arama **kalitesi** hakkında bir şey söylemiyor, yalnız yetki hakkında — bu kasıtlı | `sed -n 1,25p src/kernel/context/embedding/hash.js` | 🟢 **Etap 3d'de kapandı**   |
| B13 | Voyage adaptörü **hiç gerçek servise karşı koşmadı** — anahtar yok. Testler dokümante edilmiş yanıt biçimini taklit eden bir double'a karşı; double kendi mantığını kanıtlar, yabancıyı değil              | `grep -n VOYAGE_API_KEY src/kernel/config/env.js`   | 🔴 anahtar bekliyor         |

---

## 8. Sıradaki adımlar

### 8.1 Mühendislik zemini — kalan etaplar

| Etap     | Ne                                                                                                                 | Torı                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **E0-B** | dependency-cruiser: `kernel ✗→ domains`, döngü yok — doğrudan `error` (B5 yeşil)                                   | `npx depcruise src` temiz                                  |
| **E0-C** | `no-restricted-syntax` → `error`; `env.js`'e geç bağlamalı erişimciler; B1 kapanır. **İlk kaynak değiştiren etap** | `grep` boş döner                                           |
| **E0-D** | `tsconfig.json` + `// @ts-check` dosya dosya. `no-floating-promises` bunun için gerekli                            | `npx tsc --noEmit` temiz                                   |
| **E0-E** | zod HTTP sınırında; B2 kapanır                                                                                     | yeni test: bozuk gövde → 400 **ve hiçbir ajan çağrılmadı** |
| **E0-F** | knip + `.gehirn/` yapı doğrulayıcısı                                                                               | `npx knip` temiz · hook geçer                              |

Her etabın torunda aynı çekirdek var:

```bash
npm test && npm run evals && npm run demo    # baseline ile AYNI
```

### 8.2 Ürün — dikey kararı verildi (2026-09-10, ADR-0010)

**Toplantı notu → aksiyon maddesi → ticket**, kaynak paylaşımlı bir not sürücüsü. Kararı
kullanım senaryosu değil, **izin modeli** belirledi: üst üste binen üç mekanizma (klasör
mirası, tek kişiye paylaşım, katılımcı listesi) ve her biri bir **kural** olarak yazılabilir
— `EVALS.md` §4'ün istediği şey bu. Ticket-triyajın ACL'i `envelope.js`'in zaten yaptığı
şeydi; müşteri onboarding'in kuralları ise bir kural setinden değil bir organizasyon
şemasından gelirdi.

Sıradaki iki adım `docs/roadmap.md`'de ayrıldı, çünkü ikisi de **aynı** güvenceye (3.13)
dokunuyor — birlikte koşulursa sayının hangisinden kıpırdadığı ayırt edilemez:

| Etap | Ne                | Torı                                                                         |
| ---- | ----------------- | ---------------------------------------------------------------------------- |
| 3c   | Postgres adaptörü | 🟢 aynı ölçüm paketi Postgres'e karşı → 3.13 ve 3.14 aynı                    |
| 3d   | Gerçek embedding  | 🟡 port + iki adaptör kuruldu, her sayı aynı; **Voyage koşusu 🔴 yapılmadı** |

**K5 kararı düştü: ADR-0013.** `memory` varsayılan kalıyor, K5 yeşil; Postgres açıkça
isteniyor (`npm run evals:postgres`), asla tahmin edilmiyor. `ersetzeQuelle`'nin atomikliği
Postgres'te bedava değildi ve açıkça bir **transaction** ile kuruldu (ADR-0011).

Etap 3c üçe bölündü ve bölünmesi gerekiyordu: (1) port **asenkron** oldu — saf mekanik, torı
"bütün sayılar aynı"; (2) ACL kuralları **tek kaynak, iki derleme** aldı (ADR-0014), yine
3.13 kıpırdamadan; (3) ancak o zaman adaptör geldi. Hepsi birlikte koşulsaydı bir sapma
üçünden hangisine ait olduğu ayırt edilemezdi.

**Beklenmeyen ders:** asıl iş adaptör değil, kuralların nerede yaşayacağıydı. Ve ikinci bir
ders: SQL parantezlemesi için yazdığım ilk test, hata içerideyken **yeşil** kaldı — kurallar
kendi parantezlerini taşıyor ve regex'i kandırıyorlardı. Gerçek bir parantez sayacı gerekti.
Hiç kırmızıya dönmeyen bir test hiçbir şey ölçmez; bu, henüz yeni yazılmış bir test için de
geçerli.

### 8.3 Açık kararlar (ADR adayları)

| Soru                                                                                                                                             | Ne zaman          | Nereye                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------- |
| ~~**LangGraph 0.2.74 → 1.x?**~~ ADR-0003 olarak karara bağlandı, Etappe 0c'de uygulandı                                                          | ✅ 2026-09-09     | `DECISIONS.md`                   |
| **`express` 4 → 5?** Kalan 2 orta zafiyet yalnızca bununla kapanır. ADR-0003 kapsamı değil                                                       | Belirsiz          | `DECISIONS.md`                   |
| ~~**K5**: Postgres adaptöründen sonra demo `memory`'de mi kalsın?~~ → ADR-0013, `memory` kalıyor                                                 | ✅ 2026-09-10     | `DECISIONS.md`                   |
| ~~**Delta-sync** tam görüntü yerine?~~ → **ADR-0016**: hayır. Pahalı olan ersatz değil, embedding çağrısı; o önbelleğe alındı, tam görüntü kaldı | ✅ 2026-09-11     | `DECISIONS.md`                   |
| Lint eşikleri: 15 uyarının 3'ü ADR-0012'nin bedeli. Eşik mi yükselsin, istisna mı yazılsın?                                                      | Belirsiz          | `docs/engineering-discipline.md` |
| Tam TypeScript geçişi?                                                                                                                           | Belirsiz          | `DECISIONS.md`                   |
| `DECISIONS.md` → `docs/decisions/` bölünsün mü?                                                                                                  | ~10 ADR'den sonra | —                                |

**Pazarlık dışı sıralama:** bağımlılık geçişi ile lint rollout'u **aynı anda yapılmaz.**
Kırmızıya dönen bir testin kuraldan mı yoksa yeni kütüphane sürümünden mi geldiği ayırt
edilemez hale gelir. Bu, "bir değişiklik bir defekt" kuralının doğrudan uygulaması.

---

## 9. Komut referansı

```bash
# Çalıştırma
npm run demo             # K5 ölçütü: iskelet akışı, mock modunda, anahtar gerekmez
npm run demo:besprechung # dikey: connector → senkron → yetki geri alma → HITL → ticket
npm start                # HTTP sunucusu
npm run dev              # --watch ile

# Ölçüm
npm test                 # node:test + kapsam (alt sınır %80) → 179/179, %92,46
npm run evals            # Schicht A, iki alan, memory adaptörü (varsayılan, altyapısız)
npm run evals:postgres   # aynı paket Postgres'e karşı — DATABASE_URL ve bir DB gerekir
npm run evals -- besprechung   # yalnız bir alan (geliştirme içindir; CI hepsini koşar)

# Disiplin
npx eslint .            # 15 uyarı, 0 hata (2026-09-10; baseline 12 idi)

# Postgres yolu — sadece istendiğinde, K5'i etkilemez
docker compose up -d     # pgvector, localhost:55433, veri kalıcı DEĞİL
DATABASE_URL=postgresql://agentic:agentic@localhost:55433/agentic npm run evals:postgres
docker compose down
npx prettier --check .  # biçim kontrolü (yazmaz)
npx lefthook install    # git hook'larını senkronla

# Sınama
grep -rn "beispiel" src/kernel/                  # boş kalmalı
grep -rn "besprechung" src/kernel/               # boş kalmalı — K6
ls src/kernel | grep -vxE 'connectors|context|retrieval|agent|action|governance|llm|persistence|config|registry\.js'
                                                 # boş kalmalı — ADR-0002
grep -rn "process\.env" src/ | grep -v config/env.js   # E0-C sonrası boş
npm audit                                        # bugün 0 high, 2 moderate
```

---

## 10. Belgeler arası düzen

| Belge                            | Dil | Ne taşır                                             | Bağlayıcı mı |
| -------------------------------- | --- | ---------------------------------------------------- | ------------ |
| `PRODUCT.md`                     | 🇩🇪  | kapsam, hedefler, **Nicht-Ziele**, başarı kriterleri | ✅ sözleşme  |
| `ARCHITECTURE.md`                | 🇩🇪  | trennlinie, topoloji, bilinen sınırlar               | ✅ sözleşme  |
| `DECISIONS.md`                   | 🇩🇪  | ADR'ler — "neden böyle karar verildi"                | ✅ sözleşme  |
| `EVALS.md`                       | 🇩🇪  | metrik tanımları, baseline, mutasyon probu           | ✅ sözleşme  |
| `EXTEND.md`                      | 🇩🇪  | iskeletin büyüme sırası                              | ✅ sözleşme  |
| `docs/roadmap.md`                | 🇩🇪  | **NE** inşa edilecek — etaplar, torlar               | 🔶 öneri     |
| `docs/engineering-discipline.md` | 🇩🇪  | **NASIL** inşa edilecek — kurallar, rollout          | 🔶 öneri     |
| `.gehirn/regeln.md`              | 🇩🇪  | bağlayıcı kurallar — disiplinin **kaynağı**          | ✅           |
| `documentation.md`               | 🇹🇷  | bu belge — anlatır, yerine geçmez                    | ❌ anlatı    |

**Yetki zinciri** (çelişkide üstteki kazanır): oturumdaki kullanıcı sözü → sözleşme
belgeleri → `.gehirn/regeln.md` → `.gehirn/kern.md` ve `CLAUDE.md`.

**Bu belge en altta.** Bir sayı burada ile bir Almanca belgede farklıysa, doğru olan
çalıştırılmış komuttur — ve bu belge güncellenmelidir.
