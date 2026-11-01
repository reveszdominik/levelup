LevelUp 7.1

- Csak ikonok az alsó menüben, első a főoldal, második a heti tervező.
- Hosszú érintéses feladatrendezés eltávolítva.
- Teljesített egyszeri teendők megmaradnak a főoldalon és a heti tervezőben.
- A korábbi localStorage adatok kompatibilisek. Netlify Drop új URL esetén export/import szükséges.

Javítások (2026-11-01)

- Hibás JSON vagy sikertelen migráció esetén a mentés változatlan marad. A helyreállítási képernyőről az eredeti tartalom letölthető, egy korábbi JSON-mentés importálható, vagy megerősítés után újrakezdhető az alkalmazás.
- A múltbeli teljesítés és visszavonás a kiválasztott napot használja; a visszavonás az eredetileg jóváírt XP-t vonja le.
- Feladatszerkesztéskor a korábbi részfeladatok és kipipálásaik megmaradnak.
- Az XP-diagram napfeliratai a megfelelő dátumhoz tartoznak.
- A localStorage kulcs (`levelup-v1`) és a mentés szerkezete változatlan. A korábban hibásan duplázott teljesítéseket ez a javítás nem módosítja automatikusan.

Fejlesztői ellenőrzés

```sh
node --check app.js
node --check sw.js
node --test --test-timeout=90000 tests/regression.cjs
```

A böngészős tesztekhez Node.js, a `playwright` modul és Chromium szükséges. Az előkészített Codex-környezet ezeket tartalmazza. Más környezetben telepítsd a Playwrightot fejlesztői eszközként, és a `CHROMIUM_PATH` környezeti változóval add meg a Chromium futtatható fájlját (alapérték: `/usr/bin/chromium`). Az alkalmazás futtatása továbbra sem igényel függőséget vagy buildlépést. A tesztek elkülönített böngészőadatokat használnak, külső szolgáltatás nélkül.

Pasztell Quest megjelenés

- Törtfehér alap, levendula szintkártya kör alakú XP-jelzővel, mentazöld napi haladás és visszafogott prioritásjelölések.
- Hétfőtől vasárnapig tartó heti naptár, a teljesített napok jelölésével.
- Öt fő navigációs pont: Ma, Tervező, Jutalmak, Fejlődés és Továbbiak. A szokáskezelés, a fókuszidőzítő és a beállítások a Továbbiak menüből érhetők el.
- A korábbi kezdőlapi blokksorrend, elrejtések és a jutalomcél megmaradnak. Új adatmező vagy külső függőség nincs.
- A helyi `pastel.css` a PWA gyorsítótárának is része. Közzétételkor minden alkalmazásfájlt együtt kell frissíteni.
- A személyes köszöntés jelenleg Dominiknak szól.

Kényelmesebb napi használat

- A kezdőlap gyorsmezője Enterre vagy a + gombra egyszeri teendőt hoz létre a kiválasztott napra, 10 XP értékkel. Létrehozáskor nem jár XP. Az emoji megnyitja a részletes szerkesztőt, ahol a pontérték és a többi mező módosítható.
- A csillag gombbal naponta egy kiemelt küldetés választható. A kiemelés nem ad extra XP-t, és a meglévő listán belül jelenik meg.
- A küldetések két összecsukható listában szerepelnek: Szokások és Teendők. A kész feladatok a csoport végére kerülnek; a kategória kisebb címkeként marad meg.
- A napi XP-cél a Mai lendületed kártyába költözött, a teljesítésszámláló mellé. Külön XP-célkártya és üres heti kihíváskártya nincs a kezdőlapon. A cél továbbra is a Beállításokban módosítható.
- A Továbbiak → Feladatok nézetben és a szokás szerkesztőjében archiválás és visszaállítás érhető el. Az archiválás elrejti a szokást az aktív napi listából és a fókuszválasztóból; az előzmények, statisztikák, XP, részfeladatok és kipipálások megmaradnak. Az archivált szokások a Feladatok nézet összecsukható részében találhatók.
- A mentés azonosítója változatlan (`levelup-v1`). Az opcionális `tasks[].archived` logikai mező és a dátum → feladatazonosító értékeket tároló `dailyHighlights` objektum bővíti a mentést. A régi mentések hiányzó mezői automatikus alapértéket kapnak; a meglévő adatokat nem töröljük.

Részfeladatok, heti visszatekintés és tartós fókusz

- A feladatszerkesztőben a részfeladatok soronként adhatók meg (legfeljebb 50, egyenként 120 karakter). A listában megjelenő részfeladatszámláló megnyitja a napi pipálható lépéseket. Nem jár értük külön XP; a főfeladat továbbra is kézzel teljesíthető. Az azonos nevű lépések kipipálásai átrendezéskor megmaradnak; az átnevezett vagy törölt lépés jelölése nem kerül másik lépésre.
- A Fejlődés nézet elején heti visszatekintés mutatja a hétfőtől máig tartó aktivitást az előző hét azonos napjaihoz képest, valamint kiemel egy jól haladó szokást és egy következő lépést. A szokások céljai figyelembe veszik a létrehozást, a kijelölt napokat, a pihenőnapokat és a heti célt.
- A fókuszblokk kezdete, hátralévő ideje, szünete és befejezési időpontja a `focusTimer` opcionális mezőbe kerül. Bezárás és újranyitás után a visszaszámlálás visszaáll; a bezárás közben lejárt blokk az eredeti befejezési napra kerül jóváírásra. A fókuszblokk azonosítója véd a kettős jóváírástól; ahol elérhető, a Web Locks több ablak között is összehangolja az elszámolást. Lezárt iPhone-on nincs garantált háttérjelzés. Az állapot exportálható és importálható; az összes adat törlése a futó blokkot is törli.
- A Beállítások → XP és egyenleg nullázása megerősítést kér, az összesített XP-t, napi XP-haladást és elkölthető egyenleget nullázza, a szintet 1-re állítja. A feladatok, teljesítések, sorozatok, részfeladatok, jutalmak és előzmények megmaradnak. A korábbi XP-eseményeken opcionális `xpReset` jelölés szerepel, az egyenleg egy `xp-reset` ledger-bejegyzéssel áll nullára. A korábbi teljesítés visszavonása nem von le az új pontokból. A már átvett bónuszok nem válnak újra átvehetővé. A nullázás előtti események az előzményekben jelölést kapnak; a diagramok és XP-összesítések csak a nullázás utáni XP-t számolják.
- Az emojiválasztó a feladat- és jutalomszerkesztőben is összecsukva indul. Az ikon megnyomására megjelenik a választható lista, választás után újra bezárul.
- A `features.js` az `app.js` előtt töltődik be, és a PWA gyorsítótárának is része. Nincs új külső függőség vagy szolgáltatás. Szintaktikai ellenőrzéséhez: `node --check features.js`.
