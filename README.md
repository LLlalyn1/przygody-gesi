# Wielkie przygody gęsi (Zemsta gęsi) — prototyp v2

Gra 2D top-down (HTML5 Canvas, czysty JavaScript, bez silnika).
Zespół **Kaczki**, klasa **3aTI**. Cała gra po polsku.

Skład: Kacper Popławski (programowanie), Matvii Nepochatov (grafika/level),
Kai Antos (fabuła), Mykhailo Hasenko (programowanie/UI).

## O co chodzi
Budzisz się jako gęś w opuszczonym psychiatryku „Zofiówka” w Otwocku.
Poziomy **1–3**: zbieraj owady (8/10/12), unikaj **sanitariuszy** i **trucizny**,
otwieraj **drzwi** i uciekaj. Wygrana po 3 poziomach, przegrana przy HP 0.

## Sterowanie
- **WASD / strzałki** — ruch
- **Shift** — bieg
- **Spacja** — kwa-kwa (odstrasza, cooldown 2 s, promień 130)
- **E** — pułapka (max 4, stun 3 s)
- **P / Esc** — pauza, **M** — wyciszenie

## Mechaniki (MVP)
1. Ruch + bieg z kolizjami ze ścianami
2. Jedzenie owadów = punkty + leczenie
3. Kwa-kwa + pułapki vs sanitariusz (patrol / pościg / ucieczka)
4. Trucizna zadaje obrażenia, drzwi otwierają się po 8 owadach

## Jak uruchomić
Opcja 1 — dwuklik w `index.html` (działa bez serwera).
Opcja 2 — lokalny serwer:
```
cd game
python -m http.server 8001
```
potem otwórz http://localhost:8001

Docelowo: statyczne pliki na `just4.pl` (nginx). Bez bazy, bez logowania.

## Co dalej (po MVP)
- Multiplayer: ko-op 2 gęsi na jednej klawiaturze, potem online (WebSocket + serwer na porcie 8001)
- Dźwięki z plików, więcej pokoi, historia/flashback, ekran końcowy z zemstą
- Tłumaczenie: teraz tylko PL, potem EN/UA
