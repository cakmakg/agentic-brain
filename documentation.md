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
> **Son güncelleme:** 2026-09-08 · Etap E0-A tamamlandı.

---

## 1. Proje bir bakışta

**agentic-brain** — insan onaylı çok-ajanlı sistemler için, alandan bağımsız bir başlangıç
iskeleti. Ürün değil, **bir teknik desenler kümesi** ve içine gömülü bir ölçüm aracı.

Merkezî iddia tek cümle: _bir dosyanın var olması kanıt değildir; geçen bir kontrol komutu
kanıttır._

**Bugünkü durum:** iskelet ayakta ve yeşil. Ürün kararı (hangi dikey) henüz verilmedi —
`PRODUCT.md` §1–§4 hâlâ şablon. Mühendislik zemininin ilk etabı (E0-A) bugün kuruldu.

| Ne                   | Durum | Kanıt                                      |
| -------------------- | ----- | ------------------------------------------ |
| Uçtan uca akış       | 🟢    | `npm run demo` → `ZUGESTELLT`              |
| Testler              | 🟢    | `npm test` → 98/98, kapsam %90,53          |
| Ölçüm (Schicht A)    | 🟢    | `npm run evals` → 20/20, determinizm özdeş |
| Çekirdek/alan ayrımı | 🟢    | `grep -rn "beispiel" src/kernel/` → boş    |
| Lint zemini          | 🟢    | `npx eslint .` → 12 uyarı, 0 hata          |
| Ürün tanımı          | 🔴    | `grep -c "VORLAGE\|<!-- " PRODUCT.md` → 9  |
| Bağımlılık güvenliği | 🔴    | `npm audit` → 6 high, 5 moderate           |

---

## 2. Dosya yapısı

Bugünkü gerçek ağaç. `★` ile işaretliler bu oturumda eklendi.

```
agentic-brain/
├── src/                              27 dosya, hepsi .js (ESM)
│   ├── kernel/                       MEKANİK — hiçbir alanı tanımaz
│   │   ├── action/                   queue — ⑤ Action Layer
│   │   ├── agent/                    ④ Agent Runtime: build · routing · runner ·
│   │   │                             schema · reducers · checkpointer
│   │   ├── governance/               ⑥ Governance: guardrail · auth · rateLimiter ·
│   │   │                             trace · eventBus · costTracker
│   │   ├── config/env.js             altyapı — tüm ortam değişkenleri tek noktada
│   │   ├── llm/                      altyapı — adapter · mock
│   │   ├── persistence/              altyapı — store (iki katman birden kullanır)
│   │   └── registry.js               alan kaydı
│   ├── domains/beispiel/             ANLAM — örnek alan
│   │   ├── domain.js                 dikişin dört noktası
│   │   ├── agents/                   bearbeiter · ablage · zusteller
│   │   ├── prompts.js                tüm promptlar tek dosyada
│   │   └── actions.js                beyaz liste
│   ├── adapters/http/server.js       dış temas
│   └── bin/                          demo · serve
│
├── tests/                            node:test · npm test
├── evals/                            ölçüm aracı
│   ├── domains/beispiel/golden/      beklentiler (KURALDAN türetilir)
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

**Dikey eksen — üç motor.** _"IO'ya ne kadar uzak?"_ Her motor iki katmanı da keser.

| Motor         | `src/kernel/` tarafı                 | `src/domains/` tarafı            | Durum  |
| ------------- | ------------------------------------ | -------------------------------- | ------ |
| 1 · Bağlam    | chunking, embedding, ACL filtresi    | ontoloji, ACL kaynak modeli      | ⬜ yok |
| 2 · Ajan      | graph, runner, routing               | ajanlar, promptlar, frenler      | 🟢 var |
| 3 · Yönetişim | guardrail, kuyruk, rate limit, trace | beyaz liste, guardrail desenleri | 🟢 var |

**Hexagonal katmanlar (rand / saf mantık / use case / adapter) klasör değil, kuraldır.**
Modülün _içinde_ yaşarlar, `src/` altında kardeş dizin olarak değil:

```
kernel/context/
  store/index.js        · port          (use case)
  store/memory.js       · adapter       (infrastructure)
  retrieval/filter.js   · saf mantık    (IO görmez)
```

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

### 3.4 Dikişin dört noktası

Alan, çekirdeğe tam dört yerden dokunur:

| Yer             | Çekirdek verir                   | Alan verir                       |
| --------------- | -------------------------------- | -------------------------------- |
| Routing         | `createRouter` (yöntem)          | frenler, sırasıyla               |
| Guardrail       | `createGuardrail` (regex motoru) | desenler ve ağırlıkları          |
| Aksiyon kuyruğu | `createActionQueue` (mekanik)    | beyaz liste ve doğrulayıcı       |
| State           | çekirdek alanlar + `buildState`  | kendi alanları ve reducer seçimi |

**Sınama kriteri:** ikinci bir alan `src/kernel/` altında **sıfır satır** değiştirir.

```bash
grep -rn "beispiel" src/kernel/     # boş kalmalı → bugün 0 ✓
```

---

## 4. Güvenlik

### 4.1 Dört katman, isteğin geçtiği sırayla

| #   | Katman             | Dosya                                      | Ne yapar                                                                           | Bilinen sınırı                                                 |
| --- | ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Guardrail          | `governance/guardrail.js`                  | **LLM'siz** ağırlıklı regex, üç bant: ≥3 blok · 2 sanitize · 1 geçir ama raporla   | Regex yalnız bilinen biçimi tanır. Dış veri de düşmandır       |
| 2   | Bütçe kill-switch  | `governance/costTracker.js`                | Bütçe aşıldıysa koşu **guardrail'de** biter — ilk LLM çağrısından önce             | Mock modunda token tahmini kaba (karakter ÷ 4)                 |
| 3   | Auth + rate limit  | `governance/auth.js`, `rateLimiter.js`     | Anahtar **doğrulanır, bereinigt edilmez**; sabit-zamanlı karşılaştırma; üç limiter | SSE ucu auth'un **önünde** — koruma tahmin edilemez `threadId` |
| 4   | Aksiyon izolasyonu | `action/queue.js` + `domains/*/actions.js` | `Ajan → Kuyruk (sadece YAZAR) → Worker (okur + DOĞRULAR + çalıştırır)`             | Worker simüle ediyor; gerçek çağrı sert timeout ister          |

**Neden guardrail'de LLM yok:** güvenlik denetiminin kendisi prompt injection'a bağışık
olmalı. Bir modele _"bu metin tehlikeli mi?"_ diye sorarsan, saldıran kişi o modeli de
kandırabilir.

**Üçüncü bant bilinçli:** saldırı kelimeleri meşru bir konu olabilir. Bloklarsan yakalama
oranını yanlış pozitifle satın alırsın — metrik 3.5 iki tarafı da ölçer.

### 4.2 Üstündeki zapt: Human-in-the-Loop

Dört katman, graf onay kapısını atlarsa değersizdir. Bu yüzden zapt **çekirdekte**, bir
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

### 4.4 🔴 Bağımlılık zafiyetleri — 2026-09-08 bulgusu

```bash
npm audit          # 6 high, 5 moderate, 0 critical
```

**Hiçbiri bu oturumda kurulan geliştirme paketlerinden gelmiyor.** Hepsi mevcut üretim
bağımlılıklarından:

| Kaynak                    | Seviye   | Açıklama                                                                              |
| ------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `@langchain/core` zinciri | **high** | _LangChain serialization injection — secret extraction_                               |
| `langsmith`               | **high** | SSRF · prototype pollution · redaction bypass · güvenilmeyen manifest deserialization |
| `express` → `qs`          | moderate | array-limit bypass · DoS                                                              |
| `fast-xml-parser`         | moderate | XML comment/CDATA injection                                                           |
| `uuid`                    | moderate | buffer bounds eksik                                                                   |

`npm audit fix --force` **çalıştırılmadı** — major sürüm atlar ve onay gerektirir. Bu bulgu,
LangGraph geçişini (B4) bir güncellik meselesinden **güvenlik meselesine** çeviriyor.
Karar `DECISIONS.md`'ye ADR olarak girecek.

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

| Ölçüm             | Değer                          | Tarih      |
| ----------------- | ------------------------------ | ---------- |
| Testler           | **98 / 98 geçti**, 0 başarısız | 2026-09-08 |
| Satır kapsamı     | **%90,53** (sınır %80)         | 2026-09-08 |
| Dal kapsamı       | %91,34                         | 2026-09-08 |
| Fonksiyon kapsamı | %92,31                         | 2026-09-08 |

Kapsamdan hariç tutulanlar: `tests/**`, `src/adapters/http/server.js`, `src/bin/*.js`.

### 5.3 Ölçüm: iki katman

**Schicht A — mock modunda, deterministik, bedava, CI'da çalışır.** Model çıktısının
_kalitesini_ ölçmez; **routing ve politikaların doğruluğunu** ölçer.

**Schicht B — gerçek modele karşı, çıktı sözleşmesi olarak.** Henüz kurulmadı: bir çıktı
sözleşmesi gerektiriyor, onu da ancak gerçek bir alan verebilir.

```bash
npm run evals
```

Schicht A · alan `beispiel` · 20 görev · Mock — **2026-09-08 koşusu:**

| Metrik                        | Hedef   | Ölçülen                                      |
| ----------------------------- | ------- | -------------------------------------------- |
| 3.1 Approval-Enforcement-Rate | %100    | **%100,0** (3/3)                             |
| 3.2 Unauthorized-Action-Rate  | %0      | **%0,0** (0/3)                               |
| 3.3 Loop-Termination-Rate     | %100    | **%100,0** (17/17)                           |
| 3.4 Routing determinizmi      | %100    | **%100,0** (17/17)                           |
| 3.5 Guardrail P / R           | raporla | **P %100 · R %100** (TP 3 · FP 0 · FN 0)     |
| 3.6 Koşu başına maliyet       | raporla | medyan **0,000999 USD** (17 koşu)            |
| 3.12 Bağlam büyümesi          | raporla | medyan **×1,00** · p90 ×1,00 · tepe 37 token |
| Sözleşme uyumu                | —       | **20/20** görev beklendiği gibi              |
| Determinizm (iki geçiş)       | özdeş   | 🟢 **özdeş**                                 |

Rapor: `evals/reports/2026-09-08-schicht-a-beispiel.json`

### 5.4 Golden veri kuralı

**Bir beklenti KURALDAN türetilir, gözlenen bir koşuya asla uydurulmaz.** Kural değişirse
beklenti **yeniden türetilir**. Beklentiyi sonuca uyduran, ölçümü ortadan kaldırır — ve
her şey yeşil kaldığı için bunu hiçbir yerden fark etmez.

Bu yüzden **sentetik golden veri üretilmez.** Bu karar hem `.gehirn/regeln.md` hem de
analiz edilen kaynak metnin kendi §10.2'siyle uyumludur.

### 5.5 Başarı kriterleri

| #   | Kriter                                                 | Kontrol komutu                  | Durum |
| --- | ------------------------------------------------------ | ------------------------------- | ----- |
| K1  | Akış her dış etkiden önce insanda durur                | `npm test`                      | 🟢    |
| K2  | Ret hiçbir şey teslim etmez, hiçbir şey kuyruğa koymaz | `npm test`                      | 🟢    |
| K3  | Yeniden başlatma bekleyen onayı kaybetmez              | `npm test` (integration)        | 🟢    |
| K4  | Routing deterministik ve sonlanıyor                    | `npm run evals`                 | 🟢    |
| K5  | `clone → install → demo` taze makinede geçer           | `npm install && npm run demo`   | 🟢    |
| K6  | İkinci alan çekirdekte sıfır satır değiştirir          | `grep -rn "<alan>" src/kernel/` | 🟢    |

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

### 6.4 E0-A torı — dördü de geçti

| Kontrol                   | Beklenen          | Sonuç                                       |
| ------------------------- | ----------------- | ------------------------------------------- |
| `git status --short src/` | değişiklik yok    | 🟢 `src/` dokunulmadı                       |
| `npm test`                | baseline ile aynı | 🟢 98/98 · %90,53 — özdeş                   |
| `npm run evals`           | baseline ile aynı | 🟢 tüm metrikler özdeş, determinizm 🟢      |
| `npm run demo`            | uçtan uca geçer   | 🟢 `human_approval`'da durdu → `ZUGESTELLT` |

**Disiplini kurmak ölçümü oynatmadı.** Zaten şartı buydu: oynatsaydı hatalı olan kod değil,
kural olurdu.

---

## 7. Bulgu defteri

Her bulgunun onu bulan komutu var. Düzeltilenler açıkça işaretli.

| #   | Bulgu                                                                                                                                                    | Komut                                     | Durum                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------- |
| B1  | `src/` içinde 3 `process.env` yeri. ~~Konvansiyon çürümesi~~ → **düzeltildi:** üçü de kasıtlı geç bağlama; asıl kusur değişken adının iki yerde yaşaması | `npx eslint .`                            | 🟠 E0-C                     |
| B2  | `zod` 27 dosyadan 1'inde. HTTP sınırı parse edilmiyor                                                                                                    | `grep -rln "from \"zod\"" src/`           | 🟠 E0-E                     |
| B3  | Lint/formatter/hook/tip kontrolü yok, sıfır devDependency                                                                                                | `ls \| grep -iE "eslint\|prettier"`       | 🟢 **E0-A'da kapandı**      |
| B4  | ~~`@langchain/langgraph` 0.2.74~~ → **1.4.14**, `@langchain/core` 1.2.9, `@langchain/anthropic` 1.5.9                                                    | `npm view @langchain/langgraph version`   | 🟢 **Etappe 0c'de kapandı** |
| B5  | Çekirdek/alan çizgisi sağlam                                                                                                                             | `grep -rn "beispiel" src/kernel/` → 0     | 🟢                          |
| B6  | `PRODUCT.md` 9 şablon markası taşıyor; §1–§4 boş                                                                                                         | `grep -c "VORLAGE\|<!-- " PRODUCT.md` → 9 | 🔴 dikey kararı bekliyor    |
| B7  | ~~11 zafiyet (6 high)~~ → `high: 0`. Geriye `express` 4.x'in getirdiği 2 orta kaldı; onlar `express` 5 gerektiriyor, ayrı karar                          | `npm audit`                               | 🟢 **Etappe 0c'de kapandı** |
| B8  | `tests/schichtB.test.js` üç kullanılmayan import taşıyor — Schicht B'nin henüz iskelet olduğunun izi                                                     | `npx eslint .`                            | ⚪ küçük                    |

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

### 8.2 Ürün — dikey kararı bekliyor

`docs/roadmap.md` Etappe 0: dikey seçilir, `PRODUCT.md` §1/§3.1/§3.2 doldurulur, ontoloji
taslağı ve ilk connector belirlenir. Ontoloji, ACL modeli, aksiyon tipleri ve connector
seçimi **hepsi** bu karardan türüyor.

### 8.3 Açık kararlar (ADR adayları)

| Soru                                                                                       | Ne zaman                | Nereye         |
| ------------------------------------------------------------------------------------------ | ----------------------- | -------------- |
| ~~**LangGraph 0.2.74 → 1.x?**~~ ADR-0003 olarak karara bağlandı, Etappe 0c'de uygulandı    | ✅ 2026-09-09           | `DECISIONS.md` |
| **`express` 4 → 5?** Kalan 2 orta zafiyet yalnızca bununla kapanır. ADR-0003 kapsamı değil | Belirsiz                | `DECISIONS.md` |
| Tam TypeScript geçişi?                                                                     | Dikey seçildikten sonra | `DECISIONS.md` |
| `DECISIONS.md` → `docs/decisions/` bölünsün mü?                                            | ~10 ADR'den sonra       | —              |

**Pazarlık dışı sıralama:** bağımlılık geçişi ile lint rollout'u **aynı anda yapılmaz.**
Kırmızıya dönen bir testin kuraldan mı yoksa yeni kütüphane sürümünden mi geldiği ayırt
edilemez hale gelir. Bu, "bir değişiklik bir defekt" kuralının doğrudan uygulaması.

---

## 9. Komut referansı

```bash
# Çalıştırma
npm run demo            # uçtan uca gösterim, mock modunda, anahtar gerekmez
npm start               # HTTP sunucusu
npm run dev             # --watch ile

# Ölçüm
npm test                # node:test + kapsam (alt sınır %80)
npm run evals           # Schicht A → evals/reports/ altına tarihli rapor

# Disiplin
npx eslint .            # 12 uyarı, 0 hata (2026-09-08 baseline)
npx prettier --check .  # biçim kontrolü (yazmaz)
npx lefthook install    # git hook'larını senkronla

# Sınama
grep -rn "beispiel" src/kernel/                  # boş kalmalı
grep -c "VORLAGE\|<!-- " PRODUCT.md              # 0 olmalı (bugün 9)
grep -rn "process\.env" src/ | grep -v config/env.js   # E0-C sonrası boş
npm audit                                        # bugün 6 high, 5 moderate
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
