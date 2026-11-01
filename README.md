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
