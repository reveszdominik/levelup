LevelUp 8.0

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
node --check gamification.js
node --check features.js
node --check workflow.js
node --check sw.js
node --test --test-timeout=120000 tests/regression.cjs tests/gamification.cjs
```

A böngészős tesztekhez Node.js, a `playwright` modul és Chromium szükséges. Az előkészített Codex-környezet ezeket tartalmazza. Más környezetben telepítsd a Playwrightot fejlesztői eszközként, és a `CHROMIUM_PATH` környezeti változóval add meg a Chromium futtatható fájlját (alapérték: `/usr/bin/chromium`). Az alkalmazás futtatása továbbra sem igényel függőséget vagy buildlépést. A tesztek elkülönített böngészőadatokat használnak, külső szolgáltatás nélkül.

Pasztell Quest megjelenés

- Törtfehér alap, levendula szintkártya kör alakú XP-jelzővel, mentazöld napi haladás és visszafogott prioritásjelölések.
- Hétfőtől vasárnapig tartó heti naptár, a teljesített napok jelölésével.
- Öt fő navigációs pont: Ma, Tervező, Jutalmak, Fejlődés és Továbbiak. A szokáskezelés, a fókuszidőzítő és a beállítások a Továbbiak menüből érhetők el.
- A korábbi kezdőlapi blokksorrend, elrejtések és a jutalomcél megmaradnak. Új adatmező vagy külső függőség nincs.
- A helyi `pastel.css` a PWA gyorsítótárának is része. Közzétételkor minden alkalmazásfájlt együtt kell frissíteni.
- A személyes köszöntés a későbbi, kompakt kezdőlapból kikerült.

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

Mobilon megnyitható tesztlinkek

A GitHub Pages az éles alkalmazás mellett külön tesztkönyvtárat is kiszolgál: `preview/pr-<szám>/`. A tesztoldal létrehozásához nem kell másik tárhely vagy előfizetés. A kezdőképernyőn TESZTVERZIÓ jelzés látható, az éles alkalmazásra mutató hivatkozással.

Következő fejlesztések előnézetének előkészítése egy, az aktuális `main` ágról nyitott külön ágon:

```sh
python3 scripts/prepare-preview.py --ref <ellenőrzött-fejlesztési-commit> --slug pr-<szám>
```

Csak a generált tesztkönyvtár és az esetleges tesztinfrastruktúra változásait kell feltölteni és beolvasztani; a fejlesztés gyökérkönyvtári alkalmazásfájljait nem. A GitHub Pages sikeres közzététele után a tesztlink: `https://reveszdominik.github.io/levelup/preview/pr-<szám>/`. Az új előnézetet mindig az adott PR aktuális, ellenőrzött commitjából kell újragenerálni; a forrás commitja a tesztkönyvtár `preview.json` fájljában található. A végleges élesítés továbbra is a fejlesztési PR külön beolvasztása.

A tesztkönyvtár saját localStorage-kulcsot és fókuszzárolási nevet használ, ezért az éles alkalmazás adatai és XP-je nem változnak a teszteléstől. Nem regisztrál service workert, nem telepíthető PWA-ként, és a tesztből nem módosíthatók az éles értesítések. A tesztadatok ugyanabban a böngészőben később is megmaradnak; új PR új tesztadatokkal indul. Ezek statikus, nyilvános tesztoldalak: valódi személyes adatot ne töltsünk a repositoryba.

Keresés, átütemezés és biztonságos visszavonás

- A kezdőlapi köszöntő és mottó kikerült. A szintkártya rövid összefoglalót ad a szintről, a következő szintig szükséges XP-ről és az egyenlegről.
- A nagyító megnyitja a név szerinti keresést; ékezet nélkül is kereshetsz. Az Összes / Hátralévő / Kész szűrő nem változtatja meg a napi összesítéseket. A kiválasztott szűrő a korábbi ui objektum opcionális missionFilter mezőjében marad meg.
- A még nem teljesített teendők holnapra, hétvégére vagy tetszőleges dátumra ütemezhetők át. Az új napra átkerülnek a részfeladatok jelölései is. A teljesített teendők dátuma megmarad.
- A Feladatok nézetből, a szokásszerkesztőből vagy a Beállításokból legfeljebb 366 napos szünet tervezhető egy vagy minden aktív szokásnak. Ma vagy későbbi időszakra adható hozzá és törölhető; a már teljesített napokat a tervező nem szünetelteti. A korábbi paused dátumlista tárolja az értékeket, az előzmények és XP változatlanok.
- Feladat vagy jutalom törlése 12 másodpercig visszavonható. A visszavonás csak a törölt elemet állítja vissza, a közben elvégzett teljesítéseket nem írja felül. Újabb törlés lecseréli az előző rövid visszavonási lehetőséget; újratöltéskor ez lejár.
- Importálás, XP-nullázás és teljes törlés előtt egy külön, alkalmazáskulcsból képzett localStorage-bejegyzés őrzi az előző állapotot (levelup-v1-restore). A Beállításokban újratöltés után is visszaállítható. A visszaállítás az összes azóta végzett változtatást lecseréli; az aktuális állapot kerül a visszaállítási pont helyére. Sérült főmentés mellett is elérhető a korábbi pont. Ha a biztonsági mentés nem tárolható, az eredeti adatokat nem cseréljük le. Ez helyi védelem, nem külső biztonsági mentés.
- A workflow.js helyi fájl a többi alkalmazásszkript előtt töltődik be, és része a PWA cache-nek. A tesztoldalak saját visszaállítási kulcsot is használnak.


Interaktív, játékosított élmény (8.0)

- Egyetlen napi fejlődési kártya mutatja az aktuális szintet, a kiválasztott nap XP-jét és célját, az aktivitási sorozatot, a feladatok arányát és az elkölthető pontokat. A szintre koppintva továbbra is elérhető az XP-részletező. Az eddigi külön szint- és lendületkártyát ez váltja fel, a saját blokksorrendet és elrejtéseket megőrizve.
- A teljesítések rövid, érintést nem blokkoló +XP-visszajelzést kapnak. A napi sáv animáltan töltődik; a napi cél és az új szint külön rövid visszajelzést kap. Az új szint mellett megjelenik a következőig szükséges XP. A legmagasabb már jelzett szint és a cél elérésének napjai a mentés részei; újratöltés vagy visszavonás utáni ismételt teljesítés nem játssza újra ugyanazt a mérföldkövet. Az XP-nullázás új szintépítést tesz lehetővé, a már átvett bónuszokat megőrzi.
- A Beállítások → Visszajelzések alatt az animáció és a haptika külön kikapcsolható. A rendszer csökkentett mozgás beállítása mindig elsőbbséget kap. A haptika csak a böngésző Vibration API-támogatásával működik; iPhone/Safari alatt rezgés nélkül is használható minden funkció. Nincs külső GIF vagy animációs szolgáltatás.
- Az összecsukható Mai küldetések három napi kihívása a ténylegesen elérhető feladatokhoz igazodik. A teljesítésszám legfeljebb három, az XP-cél legfeljebb 100, és a kategóriás küldetés elérhető szokást választ. A szünetelő, archivált, későbbi vagy már betelt heti célú feladatot nem követeli meg. Feladat nélküli napon mai teendő létrehozása és fókuszblokk is lehet kihívás; ezekhez az alkalmazásban ingyen elérhető művelet tartozik. Nap közbeni eltávolításkor a még befejezetlen cél alkalmazkodik, nem nő automatikusan az új feladatokkal.
- A haladás automatikusan frissül; az egyszeri bónusz a Bónusz átvétele gombbal kérhető. A küldetések XP-je beleszámít a napi célba és a szintbe, de másik XP-küldetés feltételébe nem. A korábbi napi bónusz azonosítója (`daily3:<dátum>`) megmarad, így az adott napon régebben átvett bónusz nem fizethető ki újra. A meglévő heti bónusz továbbra is elérhető a szekción belül.
- A teljesítés visszavonása az eredeti XP-t vonja vissza, és a még át nem vett küldetés jogosultságát megszüntetheti. A már átvett napi vagy heti bónuszt nem vonja vissza; azt új teljesítéssel sem lehet újra átvenni. Az XP-nullázás előtti teljesítés visszavonása az új egyenlegből semmit sem von le.
- A teljesítések és bónuszok a fókuszhoz már használt közös Web Locks zárolás alatt olvassák újra a mentést. A gyors ismételt koppintás és a másik ablak elavult teljesítési kérése nem ír jóvá újra XP-t. Web Locks nélküli régi böngészőben az ablakon belüli védelem és az eltárolt azonosítók továbbra is működnek, de a párhuzamos ablakok összehangolása korlátozott.
- Helyi éjfélkor, illetve az alkalmazás előtérbe kerülésekor új napi küldetéssor készül. A korábbi napok állapota megmarad. A sorozat egymást követő, feladattal vagy fókuszálással aktív naptári napokat számol; ha ma még nincs aktivitás, a tegnapig tartó sorozat látható.
- A `levelup-v1` kulcs és a 7-es mentési verzió változatlan; az új opcionális mezők: `dailyMissions`, `gameFeedback`, `settings.animationsEnabled`, `settings.hapticsEnabled`, `ui.miniQuestsOpen`, `ui.gameLayoutV8`, valamint a küldetéses előzmények `missionKey` azonosítója. A hiányzó mezők migrációval kapnak alapértéket; a régi feladatok, előzmények, ledger, fókusz, mentések és visszaállítási pontok megmaradnak. A szintszámítás továbbra is `floor(XP / 200) + 1`.
- A helyi `gamification.js` a többi szkript előtt töltődik be, és része az új PWA-cache-nek. Az előnézet-generátor ezt is átveszi, külön localStorage- és visszaállítási kulccsal, az éles adatok automatikus átmásolása nélkül.
- A regressziós ellenőrzések mellett a `tests/gamification.cjs` vizsgálja a régi mentést, a megvalósítható és módosuló küldetéseket, az ismételt és többablakos XP-jóváírást, a visszavonást, a mérföldkövek egyszeri jelzését, a mozgásbeállításokat, a sikertelen mentést és a helyi éjféli napváltást. A fizikai iPhone haptikáját ezek a Chromium-alapú tesztek nem szimulálják.
