# GDD FIX — gotowe teksty do wklejenia do Karty pracy (po polsku)

Zespół: Kaczki • Klasa: 3aTI • Gra: Wielkie przygody gęsi / Zemsta gęsi

## 1. ZESPÓŁ — podział ról (do sekcji 1)
- Kacper Popławski — Programmer (ruch gracza, kolizje, wróg)
- Matvii Nepochatov — 2D Artist / Level Designer (pixel-art, mapa Zofiówki)
- Kai Antos — Narrative Designer (fabuła, teksty PL, pitch)
- Mykhailo Hasenko — Programmer / UI (HUD, poziomy, rekordy, overlay)
- Decyzje: za obszar decyduje osoba odpowiedzialna, spory — głosowanie 3/4.

## 2. KONCEPCJA — poprawki (do sekcji 2)
- Gatunek: 2D top-down action / survival (single player)
- Perspektywa: 2D top-down (rzut z góry)
- Platforma: PC / przeglądarka (HTML5 Canvas, czysty JS; gra na just4.pl)
- High Concept (2 zdania): Budzisz się jako gęś w opuszczonym psychiatryku „Zofiówka” w Otwocku. Zbieraj owady, unikaj sanitariuszy i trucizny, otwórz drzwi i ucieknij — 3 poziomy, zemsta krok po kroku.
- Wyróżnik: gęś-mściciel w polskim horror-miejscu (Zofiówka), kwa-kwa jako broń + pułapki.

## 3. CORE LOOP (do punktu C — było puste)
eksploracja korytarza → zbieranie owadów (+HP/punkty) → unikanie sanitariusza i trucizny → kwa-kwa / pułapka w obronie → otwarcie drzwi → następny poziom (trudniej) → ucieczka po 3 poziomach

## 4. GŁÓWNE MECHANIKI — minimum 3 (do punktu D — było puste)
1. Ruch + bieg (WASD/strzałki, Shift) z kolizjami ze ścianami. Ważna, bo cała eksploracja i ucieczki na niej stoją.
2. Jedzenie owadów = leczenie +6 HP i +10 pkt. Ważna, bo zmusza do ryzyka i otwiera drzwi (8/10/12 owadów).
3. Kwa-kwa (Spacja, cooldown 2 s, promień 130) odstrasza sanitariusza na 3 s. Ważna, bo daje aktywną obronę bez walki.
4. Pułapki (E, max 4, 25 s) ogłuszają wroga na 3 s. Ważne, bo pozwalają planować drogę.
5. Trucizna i drzwi (zamknięte/otwarte). Ważne, bo robią presję i jasny cel poziomu.

## 5. ŚWIAT / BOHATER — liczby (do E/F)
- Poziomy: 1–3, ten sam budynek, więcej wrogów i trucizny. Wróg poz.1: 122 px/s, poz.2: 134, poz.3: 148. Gracz: 170 (bieg 272).
- Kontakt z wrogiem: -16 HP (odporność 0,9 s). Trucizna: -20 HP/s. Pułapka: stun 3 s.
- Gęś: bieg, kwa-kwa, pułapki, jedzenie owadów. Wygrana: 3 poziomy. Przegrana: HP 0.

## 6. STYL / INSPIRACJE (do G/H — H było źle)
- Styl: pixel-art z prostokątów (placeholder pod docelowe sprite'y).
- Inspiracje: Untitled Goose Game (gęś i psoty), Vampire Survivors (prosta pętla i presja), Darkwood (polski klimat grozy).

## 7. MVP (do sekcji 4 — było „grafika i kawałek kodu”)
MVP = 1 pokój Zofiówki, gęś chodzi (WASD), 5 owadów na mapie, 1 sanitariusz (patrol/pościg), 3 plamy trucizny, drzwi zamknięte → otwarte po 8 owadach, HP/punkty/czas, ekrany menu/wygrana/przegrana, restart.
Must have: ruch, kolizje, owady, wróg, trucizna, drzwi, HUD.
Nice to have: poziomy 2–3, pauza (P), rekordy TOP5, wyciszenie (M).
Na później: ko-op 2 graczy, dźwięki z plików, boss, intro/flashback, tłumaczenia.

## 8. BACKLOG — małe zadania (do sekcji 6)
1. Ruch WASD + kolizje — Kacper — wysoki — gotowe, gdy gęś nie przechodzi przez ściany.
2. Owady (spawn/jedzenie/HP) — Mykhailo — wysoki — gotowe, gdy licznik 0/8 działa.
3. Sanitariusz patrol/pościg — Kacper — wysoki — gotowe, gdy goni <240 px.
4. Kwa-kwa + pułapki — Mykhailo — średni — gotowe, gdy strach/stun 3 s działa.
5. Drzwi + wygrana/przegrana — Mykhailo — wysoki — gotowe, gdy restart działa.
6. Mapa/pixel-art v1 — Matvii — wysoki — gotowe, gdy 1 pokój wygląda jak Zofiówka.
7. Fabuła PL + pitch — Kai — średni — gotowe, gdy teksty w grze i w GDD są po polsku.
8. Poziomy 2–3 + rekordy — Mykhailo — średni — gotowe, gdy przejście 1→2 działa.

Milestone 1: grywalny prototyp 1 poziomu (2 minuty bez wywali i bez blokad ruchu).
Ukończenie: menu → gra → drzwi → wygrana oraz gra → HP 0 → przegrana, wszystko po polsku.

## 9. PITCH (do sekcji 9 — było puste)
1. Najmocniejsza cecha: polska gęś-mściciel w prawdziwej Zofiówce — horror i humor w 5-minutowej pętli.
2. Pitch (3 zdania): Budzisz się jako gęś w opuszczonej Zofiówce. Zjadaj owady, by odzyskać siły, odstraszaj sanitariuszy kwa-kwa i stawiaj pułapki. Przejdź 3 coraz trudniejsze poziomy i ucieknij, by dokonać zemsty.
3. Ryzyko: programowanie multiplayer online jest za duże na start — tniemy do singla + ko-op lokalny na później.
4. Najpierw sprawdzamy: czy ruch + 1 wróg + 8 owadów daje frajdę w 2 minuty.
