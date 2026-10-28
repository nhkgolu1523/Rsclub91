# Balance / WINGO â€” manual test checklist

Deploy karne se pehle ye 10 checks apne phone + laptop par kar lein.
Rule: **balance hamesha = start âˆ’ Î£(bets) + Î£(wins)**. Ek rupaya bhi idhar-udhar nahi.

## Setup
1. Wingo kholo: `Games/Wingo/index.html` (ya site â†’ home â†’ Win Go).
2. DevTools â†’ Network â†’ filter `BALANCE` â†’ har write ke baad `BALANCE` **PATCH** 200 hona chahiye.
3. Console me `RSBalCore.state()` chalao â€” `{ 'MAIN-BALANCE', S, A }` dikhega.

## Checks
| # | Kya karein | Kya hona chahiye |
|---|---|---|
| 1 | Bet lagao (â‚¹10) | balance turant â‚¹10 kam; `BALANCE/MAIN-BALANCE` bhi wahi |
| 2 | Page refresh | balance wahi (â‚¹10 kata hua) â€” wapas credit NAHI |
| 3 | Turant 2 baar bet tap | ek hi bet (dusra "Please do not submit repeatedly") |
| 4 | Draw aane do (win) | balance turant +win; popup win dikhaye |
| 5 | Usi period par page 3-4 baar refresh | win sirf EK baar juda (double nahi) |
| 6 | 2 tab kholo (ek Wingo, ek home) | dono par same balance, +/- turant |
| 7 | Bet lagao, game tab band karo, draw ke baad home kholo | win credit mila hua (1.5s ke andar) |
| 8 | Airplane mode ON â†’ bet lagao | balance turant minus; net ON karne par server par bhi minus (ek hi baar) |
| 9 | Network OFF â†’ win aaya â†’ net ON | credit ek hi baar juda |
| 10 | Purana account jiska purana shape ho (`STATE` / sirf `MAIN-BALANCE` number) | pehle load par wahi balance dikhe aur naya shape ban jaye (balance 0 na ho) |
| 10b | Admin: `node tools/set-balance.js <uid> 2500` | app me turant 2500 dikhe (bina refresh) |
| 11 | Bet lagao â†’ **page refresh** karo â†’ draw hone do | win/loss **popup aata hai, draw ke ~0.5s ke andar** (period, number, amount sahi) |
| 12 | Usi result par dobara refresh | popup **DUBAARA nahi** aata (ek hi baar) |
| 13 | Bet lagao â†’ refresh â†’ game band â†’ baad me kholo | popup us waqt aaye jab result 20 min se purana na ho |
| 14 | Jaan-boojh kar **haar** wala bet (e.g. Big jab result 0-4 ho) | popup **"Sorry / Lose"** dikhaye â€” "Congratulations" NAHI |
| 15 | Jaan-boojh kar **jeet** wala bet | popup **"Congratulations" + Bonus amount** dikhaye |
| 16 | Wingo ke andar **My history** kholo (haar wala bet) | us row par **`- â‚¹stake` (lose)** dikhe â€” "+ amount" NAHI |
| 17 | Site ka **game-history** page kholo (haar wala bet) | **Fail** aur `- â‚¹stake` dikhe (win amount nahi) |
| 18 | **Multi-bet**: ek period me saare 10 numbers par â‚¹1-â‚¹1 lagao | 10 bets history me dikhein; balance se **10** katein; jeeta hua number credit kare, baaki LOSE |
| 19 | Wahi multi-bet, phir page refresh | sab bets PENDING â†’ settle hone par sahi win/lose (koi double credit nahi) |
| 20 | 10 me se **9 haar** + **1 jeet** wala multi-bet | popup me **WIN** dikhe (jeeta hua amount), "Sorry/Lose" nahi |
| 21 | Saare bets haar jayein | tab popup me **LOSS** dikhe |

## Automated
```bash
node tools/verify-balance-race.js    # 60 checks (CAS, idempotency, offline, stale, popup, shape, multi-bet guards)
node tools/verify-wingo-money.js     # 185 checks (engine + core + migration + uid churn + multi-bet popup + history)
```
Dono 0 fail hone chahiye. `verify-wingo-money.js` ko 5-6 baar chalao â€” hamesha pass
(minute-boundary flakiness fix ho chuki hai).

## Rollback
Purane (buggy) files yahan safe hain: `backup/pre-money-fix/`
(`balance.js`, `wingo-settle.js`, `wingo-engine.js`).
Wapas chahiye to copy karke `balance-core.js` ka `<script>` tag hata dein.| 22 | Admin: `USERS/<uid>/STATUS = "OFF"` | turant **Account Banned** popup aaye (block), reload/back se bhi na hà¤Ÿà¥‡ |
| 23 | Phir `STATUS = "ON"` kar ke login | popup na aaye (normal) |
| 24 | Popup khula ho aur popup ko delete karo (devtools) | 1s me **wapas** aa jaye |
| 25 | Ban popup khula ho, Escape / bahar click / back button | popup **band na ho** |