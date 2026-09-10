# PLAN PUSH do https://github.com/LLlalyn1/przygody-gesi (po polsku)

## Układ plików do wrzucenia (z folderu game/)
- index.html
- game.js
- style.css
- README.md
- .gitignore
- docs/GDD-fix-PL.md

Na GitHub mają zostać (lub przenieść do docs/stare/): Cos, Grafika, kaczki.
README na GitHub podmienić na nasze (jest nazwa, skład, silnik, jak uruchomić).

## Kolejność commitów (minimum 1 każdego członka — wymóg z karty)
1. Kai: `Add story PL and pitch` (teksty z docs/GDD-fix-PL.md sekcje 2 i 9)
2. Matvii: `Add Zofiowka map sketch and pixel-art notes` (screen lub opis + Grafika/)
3. Kacper: `Add player movement and enemy patrol` (game.js ruch + wróg)
4. Mykhailo: `Add levels HUD records and overlays` (poziomy, HUD, rekordy)

Dobre nazwy zamiast „update”: jak wyżej, po angielsku, czasownik na początku.

## Jak wgrać (lokalnie, bez VPS)
```
cd C:\Users\gasen\Documents\szkola\game
git init (jeśli trzeba) / lub klon: git clone https://github.com/LLlalyn1/przygody-gesi.git
skopiuj pliki game/ do klona
git add index.html game.js style.css README.md .gitignore docs/GDD-fix-PL.md
git commit -m "Add playable prototype v2 PL"
git push
```

VPS / just4.pl — gotowe (nginx + cert, /opt/game).
