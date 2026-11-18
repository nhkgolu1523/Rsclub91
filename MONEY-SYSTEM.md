# Money system (balance) — WINGO + site

Ye document batata hai ki Rsclub91 me paisa kaise handle hota hai, taaki
"paisa double / bet wapas credit / win add nahi hua" jaise glitches dobara
na aayein.

## Ek hi writer: `assets/js/balance-core.js`

```
USERS/<uid>/BALANCE/MAIN-BALANCE = 2500     (asli balance — admin yahin se badalta hai)
USERS/<uid>/BALANCE/S            = 12       (write-seq — stale value rok)
USERS/<uid>/BALANCE/A            = { "WIN:B123": 11, ... }   (double credit rok)
```

Teeno fields **ek hi node** (`BALANCE`) me hain aur **ek hi PATCH** me likhe jate
hain (ETag + `if-match` = CAS). `PATCH` isliye use hota hai (PUT nahi) taaki
`BALANCE` ke andar aage jo bhi key aaye wo na ude.

> Pehle `BALANCE/STATE = { V, S, A }` tha aur `MAIN-BALANCE` sirf mirror. Ab
> `V` field khatam — uski value seedha `MAIN-BALANCE` me hai, aur `S`/`A` usi
> node me siblings hain. Isliye koi adhoora write nahi hota (warna balance aur
> applied-tx do nodes me hone se race ka mauka banta).
>
> `DEPOSIT-HISTORY` / `WITHDRAWL-HISTORY` ka `BALANCE` se koi lena-dena nahi —
> wo `USERS/<uid>/DEPOSIT-HISTORY` aur `USERS/<uid>/WITHDRAWL-HISTORY` par alag
> nodes hain.

Har change (bet ka minus, win ka plus, refund) `RSBalCore.apply(txId, delta)`
se hota hai:

1. **Taaza txId** — bet `BET:<betId>`, win `WIN:<betId>`, refund `REF:<betId>`,
   directory `SET:<random>`. Wahi txId dobara aaye to SKIP (idempotent).
2. **Compare-and-swap** — `GET` `X-Firebase-ETag: true` se ETag lekar
   `PUT ... if-match: <etag>`. Koi doosra writer beech me likh de to Firebase
   `412` deta hai, hum dobara padh kar retry karte hain → **lost update nahi**.
3. **Ek hi PUT me** `V`, `S`, `A[txId]` jaate hain; uske baad mirror
   (`MAIN-BALANCE`) likha jata hai.
4. **Offline outbox** (`localStorage: rs_balsnap_v1_<uid>`) — net band ho to
   bhi change safe, UI turant dikhta hai, net aane par flush hota hai.
5. **Stale guard** — server ka purana snapshot (`S` chhota) UI ko peeche nahi
   kheencha jata; apna state CAS ke saath wapas likh diya jata hai.

Isliye: **na double credit, na "bet wapas credit", na win miss.**

## Script order (zaroori)

Har page par `balance-core.js` sabse pehle, phir `balance.js` / `wingo-settle.js`:

```html
<script src="../../assets/js/balance-core.js"></script>
<script src="../../assets/js/balance.js"></script>
<script src="../../assets/js/wingo-settle.js"></script>
```

WINGO page: `Games/Wingo/assets/js/balance-core.js` → `wingo-engine.js`
(dono copies byte-for-byte same rehni chahiye).


## Bet / win flow

| Step | Kaun | Kya |
|---|---|---|
| bet | `wingo-engine.js` `hBetting()` | pehle `betId`, phir `apply('BET:<betId>', -stake)`, phir bet node PUT `BETS-HISTORY/WINGO/<betId>` |
| bet write fail | engine | pehle **verify** (GET) ki node bana ya nahi, tabhi `apply('REF:<betId>', +stake)` |
| settle (game khula) | engine `settle()` | sirf **khatam** ho chuke period; `apply('WIN:<betId>', win)` |
| settle (game band) | `assets/js/wingo-settle.js` (site pages, 1.5s loop) | wahi `apply('WIN:<betId>', win)` |

Kyunki txId bet ke id par bandhi hai, engine + global settler + 2 tabs + reload
— sab mil kar bhi win **exactly ek baar** credit hoti hai.

## Win/loss popup (refresh-safe)

App ka popup asli me `WinningTips` component se aata hai, par uska timer **bet
lagate waqt** set hota hai (`addBetting` → `checkWinTheLottery`). Isliye page
refresh karne par wo timer khatam ho jata hai aur popup **kabhi nahi** aata tha.

Ab engine wo gap bharta hai:

1. Jab app khud result maange (`GetWinTheLotteryResult`) → us bet ko `SEEN`
   mark kar dete hain (app khud popup dikha raha hai, hum dobara nahi dikhate).
2. Boot par + har **500ms** (`checkUnseenResults`, settle ke saath sync) Firebase
   ki settled bets dekhte hain: jo WIN/LOSE bet abhi tak dikhaya nahi gaya
   (`SEEN-AT` nahi) aur 20 minute ke andar ka hai → app ka hi popup
   (`WinningTips.showMark`) khol dete hain; wo na mile to wahi markup (app ke
   CSS classes + scope-id) manually.
   Saath hi `settle()` turant `nudgePopup()` (80ms) call karta hai, isliye draw
   hone ke baad popup **~0.5s me** aa jata hai (pehle up-to 10s lag jata tha).
3. `SEEN` / `SEEN-AT` Firebase me + `we_seen_<betId>` localStorage me — isliye
   popup **ek hi baar** aata hai (dobara refresh / dusre device par bhi nahi).

**Popup ka `state` (zaroori, app se verify kiya hua):** app ke popup me
`isL = (state == 0)` hai (source: `WinningTips` →
`e=A(()=>s.value[0]?s.value[0].state==0:!1)`), yaani:

| `state` | Matlab | Popup |
|---|---|---|
| `1` | WIN | **Congratulations** + Bonus amount |
| `0` | LOSE | **Sorry** + Lose |
| `2` | pending | popup nahi (app filter: `state != 2`) |

Bet ka internal `state` bhi `1 = win`, `0 = lose` — isliye seedha wahi bhejna
sahi hai. Do cheezein dhyaan me rakhein:

- loss par `winAmount = 0` bhejna hai (internal `profitAmount` loss par bhi
  `stake*0.98` hota hai, usse "win" detect karna galat hai)
- isi rule par tests + source guards hain — koi ise ulta kare to test turant
  fail hoga



## My history (loss sahi dikhe)

Wingo ke andar do "my history" jagah hain — dono me loss sahi dikhna chahiye:

**0. Pehle tabs (ye zaroori tha!)** — record page ke tabs `GET /api/Lottery/
GetGameList` se bante hain:

```js
gameList.find(g => g.gameList?.[0]?.gameCode?.split('_')[0] === 'WinGo')?.gameList
const gameCode = tabs[active]?.gameCode            // WinGo_30S / WinGo_1M / ...
if (!gameCode) return                             // <- code na mile to API call hi nahi
await q({ pageSize: 20, pageNo, gameCode })
```

Pehle engine `GetGameList` ko handle nahi karta tha → `gameCode` `undefined` →
**record API call hi nahi hoti thi** (isliye loss bhi nahi dikhta tha). Ab
`hGameList()` WinGo ka group deta hai (`WinGo_30S`, `WinGo_1M`, `WinGo_3M`,
`WinGo_5M`).

**1. Wingo ka asli My-history page** — router `/saasLottery/WinGoRecord`
(`betRecord-DDiPQ_8b.js`) → `GET /Lottery/GetRecordPage?pageSize&pageNo&gameCode`

Iska row render:

```js
s.state != 2 ? ( class {success: s.state}
                 text  = s.state ? "Win" : "Lose"
                 amount= `${s.state ? "+" : ""}${currency(s.state
                            ? s.winLoseAmount + s.amount      // WIN
                            : s.winLoseAmount)}`              // LOSE
               ) : nothing
```

Isliye handler (`hRecordPage`) ye bhejta hai:

| Result | `state` | `winLoseAmount` | `amount` | App dikhata hai |
|---|---|---|---|---|
| WIN | `1` | `196` | `100` | **+ ₹296** (green) |
| LOSE | `0` | **`0`** | `100` | **− ₹0 / Lose** (red) |
| pending | `2` | `0` | `100` | pending |

> Pehle engine `/Lottery/*` requests ko handle hi nahi karta tha
> (`routeRaw` sirf `/api/webapi/*` aur `*.php` pakadta tha) → ye page khaali /
> galat data dikhata tha. Ab `/Lottery/<Name>` bhi route hota hai aur query
> params padhe jate hain.

**2. Wingo ke andar "My history" list** (`MayrecordList`) — app ka render:

```js
e.profitAmount ? ( :class="{success: e.state}"
                   {{ e.state ? "Win" : "Fail" }}
                   {{ `${e.state ? "+" : "-"}${currency(e.profitAmount)}` }} ) : kuch nahi
```

Yani **`profitAmount` TRUTHY hone par hi wo line banti hai**, aur label/sign/colour
`state` se aate hain. Isliye `GetMyEmerdList` me:

| Result | `state` | `profitAmount` | App dikhata hai |
|---|---|---|---|
| WIN | `1` | `196` (jeeta hua) | **Win** (green) `+ ₹196` |
| LOSE | `0` | `stake*0.98` = `98` | **Fail** (red) `- ₹98` |
| pending | `2` | — | kuch nahi |

> ⚠️ Loss par `profitAmount = 0` bhejna **galat** hai — 0 falsy hai, isliye app wo
> line **render hi nahi karta** (loss par kuch bhi nahi dikhta). Ye galti ek baar
> ho chuki thi; ab test 10 isko pakadta hai.

**3. Site ka `pages/game-history`** (`assets/js/game-history.js`) Firebase ke
`STATUS` (`WIN`/`LOSE`) aur `WIN-AMOUNT` (loss par `0`) se padhta hai — loss
par `fail` class + `- ₹stake`.

## Admin: kisi bhi user ka balance badalna

```
node tools/set-balance.js <uid> <balance>
   e.g.  node tools/set-balance.js 12345678 2500
```

Ye `GET` (ETag) → `PATCH { 'MAIN-BALANCE': <balance>, S: <S+1> }` karta hai.
`S` khud badhta hai, isliye stale-guard naya value reject nahi karta aur app me
**turant** naya balance dikhta hai (chaalu tabs 4s poll me utha lete hain).
`A` (applied txIds) aur `BALANCE` ki koi doosri key waise hi rehti hai.

## Migration (purane users — auto, balance 0 nahi hota)

`refresh()` par purane shapes khud naye shape me dhal jate hain:

| purana shape | naya |
|---|---|
| `BALANCE/STATE = { V, S, A }` | `MAIN-BALANCE = V`, `S`, `A` upar (aur `S+1`) |
| `BALANCE/MAIN-BALANCE = 5000` (number, S/A nahi) | `= 5000`, `S`, `A` upar |
| `BALANCE/STATE = { 'MAIN-BALANCE', S, A }` | wahi utha lega |

Migrate hote waqt purani `A` bhi shift hoti hai, isliye purani wins dobara
credit nahi hoti.

## ⚠️ Do zaroori cheezein (inhe bhoolna nahi)

**1. Firebase khaali object `{}` ko DELETE kar deta hai.**
```json
PUT BALANCE = { "MAIN-BALANCE":0, "S":1, "A":{} }
→ DB me bachta hai: { "MAIN-BALANCE":0, "S":1 }     // A gayab!
```
Isliye `A` khaali ho to code ek placeholder daal deta hai (`{ INIT: 1 }`), aur
register (`pages/login/backend.js`) bhi `A: { INIT:<uid>: 1 }` likhta hai.
Warna `A` node banega hi nahi aur idempotency (double-credit rok) kaam nahi karegi.

**2. Node delete karna = account reset.**
`BALANCE` node delete karne par app **purana cached balance wapas nahi likhta**:
cache + pending outbox discard, UI turant **0**, server par fresh node
`{ MAIN-BALANCE: 0, S: 1, A: {INIT:1} }`. Aur balance 0 hone par bet **reject**
hoti hai (koi bet node nahi banta).

**3. `setUid` sirf user badalne par state reset karta hai.**
Pehle har `balUid()` call core ka state (`A`/`S`/outbox) reset kar sakti thi, jisse
bet lagne ke beech me hisaab bigadta tha (bet `A` me chala jata par
`BETS-HISTORY` me node nahi banta → win par kuch add nahi hota tha, popup bhi
nahi aata tha). Ab `setUid` guard lagaya hua hai aur engine uid sirf **ek baar**
core ko batata hai.

**4. Multi-bet (ek period me kai bets) — betId har bet ka alag.**
Pehle `newBetId()` sirf `Date.now()` (millisecond) use karta tha, isliye jab user
ek saath 10 numbers par bet lagata tha, **saare ids ek jaise** ban jate the →
idempotency unhe "already applied" maan kar chhod deti thi → paisa sirf ek baar
katta, baaki bets gayab. Ab id me counter + random suffix bhi hai.

Hisaab kaise hota hai (result 0, 10 numbers par Rs.1-Rs.1):
```
debit  = 10 x 1              = 10.00
credit = 1 x 0.98 x 9 (0 jeeta) = 8.82
net    = -1.18   (jaisa hona chahiye)
```
Test 17 yahi poora scenario check karta hai: 10 debit tx, **sirf 1** win credit,
Firebase me 1 WIN + 9 LOSE, aur dobara settle karne par **double credit nahi**.

**5. Multi-bet me popup WIN wala dikhta hai (agar ek bhi jeeti).**
Ek period me user ki kai bets ho sakti hain (kuch jeeti, kuch haari). Popup
**period-wise** chuna jata hai:
- koi bhi bet jeeti → **WIN** popup (sabse zyada jeet wali bet ka amount)
- sab haari → **LOSS** popup

(Pehle list me jo bet pehle milti thi wahi dikhti thi — 9 loss + 1 win me
aksar LOSS dikh jata tha, jo user ke liye galat feel tha.)

Test 19 yahi check karta hai: 9 loss + 1 win → WIN popup (₹8.82), sab loss →
LOSS popup, aur app ke apne API me bhi WIN wali bet.

## Utility tools

| Command | Kaam |
|---|---|
| `node tools/check-balance-shape.js <uid>` | live BALANCE node ka shape dekho |
| `node tools/set-balance.js <uid> <amount>` | admin: balance set (S auto +1) |
| `node tools/reset-account.js <uid> --bets` | account fresh (BALANCE reset + BETS-HISTORY delete) |

## Tests

```bash
node tools/verify-balance-race.js   # 60 checks: CAS / idempotency / offline / stale / popup / shape / multi-bet guards
node tools/verify-wingo-money.js    # 185 checks: engine + core + migration + uid churn + multi-bet + popup + history
```

`verify-wingo-money.js` me ye scenarios hain: bet instant minus, draw se pehle
result reveal nahi, double tap, refund, ack-lost (free bet nahi), result PATCH
fail hone par bhi credit, "game band karke site par wapas" wala credit, refresh
ke baad popup (win + loss), aur my-history ka win/loss.

## Purana (buggy) code — wapas mat laana

Hata diya gaya: `GET → +delta → PUT absolute`, `_pullBlockUntil` /
`_writeValueUntil` jaise time-window guards, session-wide `SETTLED-BY` token,
aur 2s balance poll. `verify-balance-race.js` inke wapas aane par fail ho jata hai.

> Note: Realtime Database rules abhi locks nahi hain (jaisa tha waisa). Rules
> lock karne par client sirf **padh** sakega aur likhna sirf server karega —
> us waqt `BALANCE`/`BETS-HISTORY` ka write path server (Cloud Function ya
> Cloudflare Worker) me move karna hoga.

## Account Ban (STATUS = OFF)

`assets/js/account-ban.js` (home page me load hota hai, sirf 1 script tag):

```
USERS/<uid>/STATUS = "OFF"   ->  turant Account Banned popup + poora block
                   = "ON"    ->  normal
```

- Check: **chhota** `STATUS.json` GET (15 bytes) — **10s** par, aur page load /
  focus / tab visible / online hone par **TURANT**.
- Sirf exact `off` (case-insensitive) par ban. `null` / missing / garbage /
  network fail par **kuch nahi** (jhoothi ban nahi).
- **Load zero**: single-flight (ek waqt me ek request), timeout 5s + abort,
  fail par backoff 10→20→40→60s (+jitter), tab hidden ho to poll **band**,
  aur ban dikhne ke baad poll **poori tarah band**.
- **Bypass-proof (client level)**: popup DOM se delete karo to 1s me wapas,
  Escape / bahar-click se band nahi hota, `hashchange`/`popstate` blocked,
  scroll/app hide, reload par server se dobara check, `localStorage` se
  status fake karne par bhi decision server se hi hota hai.
- `Log Out` -> session keys clear -> `pages/login/index.html`.
- Reason text **fixed** ("Reason Cheat" + cheat wala text) — dynamic nahi.

Tests: `node tools/verify-account-ban.js` (41 checks).