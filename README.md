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
node --test --test-timeout=60000 tests/regression.cjs
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

Mobilon megnyitható tesztlinkek

A GitHub Pages az éles alkalmazás mellett külön tesztkönyvtárat is kiszolgál: `preview/pr-<szám>/`. A tesztoldal létrehozásához nem kell másik tárhely vagy előfizetés. A kezdőképernyőn TESZTVERZIÓ jelzés látható, az éles alkalmazásra mutató hivatkozással.

Következő fejlesztések előnézetének előkészítése egy, az aktuális `main` ágról nyitott külön ágon:

```sh
python3 scripts/prepare-preview.py --ref <ellenőrzött-fejlesztési-commit> --slug pr-<szám>
```

Csak a generált tesztkönyvtár és az esetleges tesztinfrastruktúra változásait kell feltölteni és beolvasztani; a fejlesztés gyökérkönyvtári alkalmazásfájljait nem. A GitHub Pages sikeres közzététele után a tesztlink: `https://reveszdominik.github.io/levelup/preview/pr-<szám>/`. Az új előnézetet mindig az adott PR aktuális, ellenőrzött commitjából kell újragenerálni; a forrás commitja a tesztkönyvtár `preview.json` fájljában található. A végleges élesítés továbbra is a fejlesztési PR külön beolvasztása.

A tesztkönyvtár saját localStorage-kulcsot és fókuszzárolási nevet használ, ezért az éles alkalmazás adatai és XP-je nem változnak a teszteléstől. Nem regisztrál service workert, nem telepíthető PWA-ként, és a tesztből nem módosíthatók az éles értesítések. A tesztadatok ugyanabban a böngészőben később is megmaradnak; új PR új tesztadatokkal indul. Ezek statikus, nyilvános tesztoldalak: valódi személyes adatot ne töltsünk a repositoryba.
