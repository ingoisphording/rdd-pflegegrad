# RDD-Übung: Pflegegrad 3 und die Arbeitszeit pflegender Angehöriger

Interaktive Übung zum Regressions-Diskontinuitäts-Design (scharfes RDD) für das Selbststudium.
Studierende führen in 11 Schritten (etwa 10 bis 15 Minuten) eine RDD-Analyse an einem
simulierten Datensatz durch: Zuteilungsregel, Rohdaten, gruppierte Mittelwerte, naiver
Vergleich, lokale lineare Schätzung, Bandbreite, Manipulation, Placebo-Test, Interpretation.
Eine Startseite nennt Kontext, Daten und Lernziele; sie erscheint beim ersten Aufruf und nach
„Von vorn“. Wer schon begonnen hat, landet direkt beim gespeicherten Schritt. „Zurück“ führt
zum vorigen Schritt; gelöste Schritte bleiben gelöst. Erklärkästen („Neu: …“) führen Inhalte
ein, die über die Vorlesung hinausgehen: scharfes und unscharfes RDD (Schritt 2), Bandbreite
(Schritt 6), lokale lineare Regression (Schritt 7), Wahl der Bandbreite (Schritt 8).

**Live:** https://ingoisphording.github.io/rdd-pflegegrad/

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seite (Deutsch, `lang="de"`) |
| `styles.css` | Gestaltung; Farben wie in den Vorlesungsfolien (grau = Pflegegrad 2, orange = Pflegegrad 3) |
| `app.js` | Schritte, Ablauf, Schätzer, Grafik (SVG) |
| `data.js` | Daten und Lösungsschlüssel, **erzeugt**, nicht von Hand bearbeiten |
| `data.csv` | dieselben Daten zum Herunterladen |
| `rdd_pflegegrad.R` | kommentiertes R-Skript für Studierende: rechnet alle Schritte nach (Download im letzten Schritt) |
| `data/generate_data.R` | datengenerierender Prozess, Seed, Export, Lösungsschlüssel |
| `.nojekyll` | verhindert, dass GitHub Pages Jekyll ausführt |

Keine Abhängigkeiten, kein Build-Schritt, keine externen Anfragen (keine CDNs, Web-Fonts,
Cookies oder Analysedienste). `index.html` funktioniert auch direkt von der Festplatte.

## Daten

Simuliert in R 4.5.2 mit Seed `20261118`, N = 1.200, stilisiert nach § 15 SGB XI:

- Laufvariable X: Punktzahl der Begutachtung, gleichverteilt auf [27, 70), auf 0,1 gerundet
- Behandlung D = 1[X ≥ 47,5] (Pflegegrad 3 statt 2), zugewiesen **nach** dem Runden
- Ergebnis Y: Wochenarbeitsstunden der Hauptpflegeperson,
  Y = 24 − 0,30·(X − 47,5) + 0,0004·(X − 47,5)³ − 3·D + ε, ε ~ N(0; 3,5²), auf 0,1 gerundet
- Kovariate W: Alter der Pflegeperson, W = 52 + 0,15·(X − 47,5) + u, u ~ N(0; 7²), ganzzahlig
- Szenario B (nur Histogramm, Schritt 9): 60 % der Fälle mit X in [45,5; 47,5) nach [47,5; 48,5) verschoben

Wahrer Effekt: −3 Stunden. Der kubische Term macht sehr breite Bandbreiten sichtbar verzerrt.
Die Parameter wurden bei festem Seed so gewählt, dass der naive Vergleich mindestens doppelt
so groß ist wie der Effekt und die Schätzung bei der Lehr-Bandbreite nahe am wahren Wert liegt.

## Lösungsschlüssel

Lokal linear, Dreieckskern, Bandbreite h = 8 (MSE-optimale Bandbreite aus `rdbwselect`, 7,74,
gerundet). Die Punktschätzung entspricht der konventionellen Schätzung von
`rdrobust(y, x, c = 47.5, h = 8, kernel = "triangular", p = 1)` (rdrobust 4.1.1).

| Größe | Wert |
|---|---|
| Naiver Vergleich (rechts minus links) | −7,63 Stunden |
| RDD-Schätzung, h = 8 | −2,97 Stunden (Std.-Fehler 0,86) |
| RDD-Schätzung, h = 20 | −3,58 Stunden |
| Placebo (Alter), h = 8 | 1,50 Jahre, robuster p-Wert 0,23 |

`app.js` rechnet beim Laden alle Werte nach und prüft sie gegen die Werte aus R
(`console.assert`, Toleranz 0,001). Die Übung ist für das Selbststudium gedacht, nicht für
Prüfungen.

Daten neu erzeugen (im Repository-Ordner):

```
Rscript data/generate_data.R
```

Das Skript schreibt `data.csv`, `data.js` und das Protokoll `../logs/rdd_pflegegrad_answer_key.log`
(außerhalb des Repositorys).

## Veröffentlichung

GitHub Pages, „Deploy from a branch“, Branch `main`, Ordner `/ (root)`. Die Seite zeigt immer
den letzten Stand von `main`; vor einem Einsatz in der Lehre einen Tag setzen und danach nicht
mehr pushen.
