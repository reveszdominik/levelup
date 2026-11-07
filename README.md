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

Egyszerűbb kezdőlap

- A fejlécben csak a LevelUp márkanév marad; a mottó és a napi kártya motivációs mondata kikerült. A napi és a szokásonkénti sorozat ikonja villám.
- A naptár nyilai helyett a napokat oldalra húzva lehet előző vagy következő hétre lapozni. A natív görgetés a hetek elejére igazodik, újra és újra mindkét irányban folytatható. A napokra továbbra is lehet koppintani; billentyűzettel a bal/jobb nyíl napot vált, a Ma gomb visszahoz a mai napra. A heti tervező ugyanazt a naptársávot használja. A lapozás nem módosít adatot vagy XP-t.
- A Mai feladatok címe mellől kikerült a kereső és a kiemelő csillag. A korábban mentett kiemelések adatai megmaradnak. Az Összes / Hátralévő / Kész szűrők továbbra is használhatók.
- A gyors teendő + gombja mellett azonos magasságú és megjelenésű Részletes teendő gomb található. Átveszi a gyorsmező nevét, egyszeri teendővel és a kiválasztott nappal nyitja meg a szerkesztőt; a szokások szerkesztése és létrehozása a többi nézetben változatlan.
- A Mai küldetések tömörebb sorokban mutatja a címet, bónuszt, haladást és az egyszeri átvételt. A Korábbról maradt teendők hasonló, alapból összecsukott részbe kerültek; a fejléc mutatja a darabszámot. Megnyitása az opcionális `ui.overdueOpen` mezőbe mentődik, így áthozás és újratöltés után is megmarad. Az áthozás és a részfeladatok jelölése változatlanul működik.
- A mentési kulcs, a mentési verzió, az XP-elszámolás és a küldetéscélok változatlanok. A PWA-cache új azonosítót kapott, a GitHub Pages-előnézet továbbra is külön adatokat használ.

Kihívások és kezdőlapi sorrend

- Az egyszeri elrendezésfrissítés a főoldali blokkokat Szint és napi fejlődés → Kihívások → Naptár → Feladatok sorrendbe teszi, a többi blokkot ezek után hagyva. A mentés opcionális `ui.challengeLayoutV1` jelzője biztosítja, hogy ez ne írja felül minden betöltéskor a későbbi saját sorrendet; a blokkok továbbra is testreszabhatók. A naptár külön `calendar` blokk, a rejtési beállítások és minden teljesítés, XP, cél és jutalom változatlanok.
- A Kihívások feliratú lenyíló kártyán belül előbb a Heti kihívások, elválasztó után a Mai küldetések szerepelnek. A heti rész akkor látható, ha van aktív beállított heti kihívás vagy már megkezdett/átvett heti bónusz. Az eddigi külön heti kihívásblokk és a heti bónusz további lenyílója megszűnik, ugyanazok az átvételi és törlési műveletek az egyesített kártyában érhetők el.
- A mai küldetések mindig a helyi mai naphoz tartoznak; a Kihívások kártya a naptár lapozása közben is a helyén marad. A fejléc számlálója a három mai küldetés haladását jelzi. A napi és heti bónuszok elszámolása, egyszeri átvétele és mentett azonosítói nem változtak.

Kihívások a szintkártyában

- A heti és napi kihívások a szint/napi fejlődés kártya aljába kerültek. A Kihívások sáv natív lenyíló: csak ez nyitja/csukja a listát, és maga a szintkártya növekszik meg. A heti/napi elkülönítés, az egyszeri bónuszátvétel és a `ui.miniQuestsOpen` megnyitási beállítás változatlan.
- A szint melletti ikon önálló, legalább 44×44 px-es gombként nyitja az XP-részletezőt. Nem nyitja ki a kihíváslistát; a Kihívások sáv és a bónuszgombok nem nyitnak XP-ablakot.
- A külön `quests` kezdőlapi blokksorrend-elem megszűnik. A korábbi `ui.hidden` elrejtési beállítása továbbra is érvényes; a Beállításokban a Kihívások a szintkártyában jelölővel külön kapcsolható a sáv. A szintkártya és a többi blokk sorrendje továbbra is módosítható. Az adatok és a mentési verzió nem változnak.

Szint lap és kompakt főoldal

- A korábbi Tervező navigációs pont neve Szint, csillag ikonnal. A belső `planner` nézetazonosító megmaradt; a korábbi heti tervező tartalma, naptára és hozzáadógombja itt nem jelenik meg. A lap csak két külön kártyát tartalmaz: a teljes szint/napi fejlődés kártyát és a mindig látható Kihívások kártyát. A kihívások nem csukhatók össze; felül a meglévő heti kihívások, alattuk elkülönítve a mai küldetések láthatók. Az XP-ikon továbbra is a részletező ablakot nyitja.
- A főoldal tetején ismét a húzható naptár található. A napi összefoglaló kizárólag az adott nap XP-jét/célját, a haladássávot, a teljesítésszámlálót és az elkölthető pontokat mutatja. A szintfejléc, az XP-ikon, a streak és a kihívások a Szint lapra kerültek. A szokások, teendők, részfeladatok, áthozás és átütemezés továbbra is a főoldalról használhatók.
- A Szint lap mindig a helyi mai nap adatait mutatja, a főoldal naptári kiválasztásától függetlenül. Az XP-sáv animációja a megjelenített kártya napjához igazodik, így a mai bónusz ott is visszajelzést ad, ha előtte a főoldalon másik napot néztél.
- A naptár már nem külön rendezhető/elrejthető blokk, hanem állandóan a főoldal tetején marad. A `calendar` és `quests` elemek kikerülnek a kezdőlapi blokksorrendből. A korábbi megnyitási és elrejtési adatmezők megmaradnak a mentésben, de nem rejtik el és nem csukják össze a Szint lap két kártyáját. A többi kezdőlapi blokk beállítása és minden felhasználói adat, cél, teljesítés, XP, bónuszazonosító változatlan.

Kompakt főoldali fejléc

- A Mai feladatok cím, a gyors teendőbeviteli mező, a gyors +, a Részletes teendő gomb és a folyamatosan látható szűrősáv kikerült a főoldal tartalmából. A jobb felső fejlécben az új sorrend: streak jelvény → szűrőikon → +.
- A 44×44 px-es, lekerekített + a meglévő részletes szerkesztőt nyitja meg, alapból egyszeri teendővel és a főoldalon kiválasztott nappal. Ugyanitt szokás is választható; a pontérték, dátum, részfeladat, kategória és ismétlődés továbbra is szerkeszthető. Mentéskor nem jár XP. A részletes szerkesztő eddigi alapértéke megmarad, a külön 10 XP-s gyorsrögzítés megszűnik.
- A szűrőikon lenyílója az Összes / Hátralévő / Kész lehetőségeket tartalmazza. Ugyanazt az opcionális `ui.missionFilter` mezőt használja, a meglévő szűrés megmarad újratöltés után. Választáskor a menü bezárul, a fókusz visszakerül az ikonra. Külső érintésre és Escape-re is bezárul; az aktív szűrést kis pont jelzi. A napi összesítés és az XP nem változik szűréskor.
- A fejlécben és a Szint lapon ugyanaz a helyi mai aktivitási sorozat jelenik meg, függetlenül a főoldalon kiválasztott naptól. A jelvény és a két ikon azonos, legalább 44 px magas. A fejléc eszközei csak a főoldalon látszanak; a Szint lap két külön kártyája megmarad.
- Nincs új mentési mező vagy szolgáltatás. A korábbi adatok és elrendezési beállítások megmaradnak; az előnézeti teszt a korábbi, gyorsrögzítős tesztoldalak ellenőrzését is támogatja.

Egyszerűbb Jutalmak lap

- A Jutalmak lap a főoldallal azonos fejlécet használ: mai streak, saját lenyíló szűrő és jobb oldali +. A + a jutalomszerkesztőt nyitja; a főoldali feladathozzáadás változatlan. A Jutalombolt cím melletti egyenlegjelvény és az XP előtti érmeikon kikerült. Az egyenlegkártya kisebb, csak a feliratot és az elkölthető XP-t mutatja, a korábbi magyarázó mondat nélkül.
- A jutalmak a főoldali feladatsorokhoz hasonló, elválasztott listában jelennek meg. A név és az ár mellett egy sorban három 44×44 px-es gomb található: ⚙️ szerkesztés, 🎯 célként kitűzés/cél törlése, ✓ beváltás. A célgomb kijelölése színnel és `aria-pressed` állapottal látszik; minden ikongombnak egyértelmű akadálymentes neve van. Hosszú neveknél a név tördelhető, a gombok egy sorban maradnak.
- A jutalomszűrő lehetőségei: Összes, Beváltható (ár ≤ egyenleg), Még gyűjtök (ár > egyenleg), Célom. Az opcionális `ui.rewardFilter` mező a feladatok `ui.missionFilter` beállításától független, újratöltés után is megmarad. A szűrés sem XP-t, sem egyenleget nem változtat. A lenyíló választásra, külső érintésre és Escape-re bezárul; nincs találat esetén az Összes jutalom művelettel visszaállítható.
- A beváltás megerősítése, az elégtelen egyenleg miatti tiltás, az időzített jutalmak, a jutalomcél és a beváltási előzmények megmaradtak. A beváltás az elkölthető pontokat csökkenti, az összegyűjtött XP-t és szintet nem. A mentési kulcs és a 7-es mentési verzió változatlan; nincs új szolgáltatás vagy függőség.

Jutalomkategóriák, előzmények és visszaszámlálók

- A Beváltási előzmények emoji nélküli, a kihíváskártyához illeszkedő, alapból összecsukott kártya. A megnyitás az opcionális `ui.rewardHistoryOpen` mezőben újratöltés után is megmarad; minden korábbi előzmény és az elköltött összeg változatlan.
- A jutalomszerkesztő Kategória legördülője a meglévő saját kategóriákat használja. A kategória a jutalom neve alatt is látszik; a listában külön, összecsukható kategóriacsoportok szerepelnek. A `rewards[].category` opcionális mező hiányában a jutalom az Egyéb csoportba kerül. A régi egyedi kategóriák választhatók maradnak. Jutalom által használt kategória sem törölhető a Beállításokból. A jutalomszűrés a csoportokon belül is működik.
- Időkorlátos jutalom beváltásakor az elkölthető egyenleg kártyájában megjelenik a név, a hátralévő idő és a hátralévő idővel arányos sáv. Több aktiválás külön időzítőt kap. Az érték a mentett `end` időpontból, másodpercenként frissül, újratöltés és előtérbe visszatérés után is helyes. Lejáratkor a sáv eltűnik, XP-változás vagy visszatérítés nélkül; a jutalom szűrése, szerkesztése vagy más csoport összecsukása nem indítja újra a futó időt.
- A meglévő `activeRewards` elemek `id`, `name`, `end` mezői megmaradnak. Új opcionális mezők: `rewardId`, `startedAt`, `durationMs`. Az aktiváláskori időtartam rögzített, ezért a jutalom későbbi szerkesztése nem módosítja. Régi időzítőnél a lejárat változatlan; az eredeti időtartam hiányában a sávhoz a kapcsolódó jutalom beállított idejéből vagy a megmaradt időből számolunk alapot, amely mentésre kerül.
- A beváltás friss mentésből, a meglévő közös zárolás alatt, egyetlen sikeres mentéssel terheli az egyenleget és hozza létre az előzményt/időzítőt. Sikertelen írás nem hoz létre látszólagos aktiválást; a gyors ismételt kattintás nem terhel kétszer. Az újabb, külön megerősített beváltás továbbra is lehetséges elegendő ponttal. A szerkesztő is csak sikeres mentés után zárul be.
- A mentési kulcs és a 7-es verzió változatlan. Nincs külső szolgáltatás vagy háttérfolyamat: a visszaszámláló nyitott alkalmazásban frissül, visszatéréskor a valós lejárati időhöz igazodik; háttérben lejárati értesítést nem ígér.

Önálló jutalomkategóriák és a szokásokhoz igazított jutalomsorok

- A jutalom nagy, 44×44 px-es bal oldali emojiikonjára koppintva nyílik meg a szerkesztő. A külön fogaskerék megszűnik. A kategória a szokásokéhoz hasonló pontjelöléssel, a név alatt látszik. Az ár jobb oldalon, a beváltási pipa mellett, mínuszos XP-ként jelenik meg; ez megjelenítési változás, a tárolt ár továbbra is pozitív.
- A jutalomkategóriák külön, opcionális felső szintű `rewardCategories` listába kerülnek; a szokások/teendők meglévő `categories` listáját nem módosítják. A Beállításokban külön Szokások és teendők kategóriái, illetve Jutalomkategóriák rész van, önálló hozzáadással és törléssel. Azonos nevű kategória mindkét listában szerepelhet, egymástól függetlenül.
- A régi mentésből csak a jutalmakhoz már hozzárendelt címkék kerülnek az új listába, az Egyéb alapértékkel. Az összes feladatkategóriát nem másoljuk át. A jutalomszerkesztő csak a külön jutalomlistából kínál választást; a régi jutalomcímkék és az újonnan létrehozott, még nem használt kategóriák export/import és újratöltés után is megmaradnak.
- A használt kategóriák törlési védelme listánként működik: jutalom nem akadályozza az azonos nevű, feladatok által nem használt feladatkategória törlését, és fordítva. A meglévő időzítők, előzmények, szűrők, célok és az XP-elszámolás változatlanok. A mentési kulcs és verzió nem változott.
