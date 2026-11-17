# =============================================================================
# RDD-Übung: Pflegegrad 3 und die Arbeitszeit pflegender Angehöriger
# Alle Schritte der Online-Übung selbst nachrechnen.
#
# So führen Sie das Skript in RStudio aus:
#   1. Dieses Skript und data.csv in denselben Ordner legen.
#   2. Skript in RStudio öffnen (File > Open File).
#   3. Session > Set Working Directory > To Source File Location.
#   4. Zeile für Zeile mit Strg+Enter (Mac: Cmd+Enter) ausführen
#      oder alles auf einmal mit dem Knopf "Source" oben rechts im Skriptfenster.
#
# Die Daten sind simuliert. Der wahre Effekt beträgt -3 Stunden pro Woche.
# =============================================================================


# --- 0. Paket installieren (nur beim ersten Mal, braucht Internet) und laden --
if (!requireNamespace("rdrobust", quietly = TRUE)) install.packages("rdrobust")
library(rdrobust)


# --- 1. Daten einlesen ------------------------------------------------------
# Liegt data.csv im Arbeitsverzeichnis, wird diese Datei verwendet,
# sonst die Online-Version der Übung.
datei <- "data.csv"
if (!file.exists(datei)) {
  datei <- "https://ingoisphording.github.io/rdd-pflegegrad/data.csv"
}
daten <- read.csv(datei)

# Variablen:
#   x  Punktzahl der Begutachtung        (Laufvariable)
#   d  Pflegegrad 3: 1 = ja, 0 = nein    (Behandlung)
#   y  Wochenarbeitsstunden der Hauptpflegeperson (Ergebnis)
#   w  Alter der Pflegeperson            (für den Placebo-Test)
str(daten)
summary(daten)


# --- 2. Schwelle und Zuteilungsregel (Schritte 1 und 2) --------------------
schwelle <- 47.5

# Anteil mit Pflegegrad 3 unter (FALSE) und ab (TRUE) der Schwelle:
# 0 und 1, also ein scharfes RDD.
tapply(daten$d, daten$x >= schwelle, mean)


# --- 3. Gruppierte Mittelwerte (Schritte 3 und 4) --------------------------
# Rohdaten: jeder Punkt ein Haushalt
plot(daten$x, daten$y, pch = 20, col = ifelse(daten$d == 1, "darkorange", "grey50"),
     xlab = "Punktzahl der Begutachtung", ylab = "Arbeitsstunden pro Woche",
     main = "Rohdaten")
abline(v = schwelle, lty = 2)

# Mittelwerte in Intervallen von 2 Punkten, an der Schwelle ausgerichtet
intervall <- floor((daten$x - schwelle) / 2)
mx <- tapply(daten$x, intervall, mean)
my <- tapply(daten$y, intervall, mean)
plot(mx, my, pch = 19, col = ifelse(mx >= schwelle, "darkorange", "grey50"),
     xlab = "Punktzahl der Begutachtung", ylab = "Arbeitsstunden pro Woche",
     main = "Gruppierte Mittelwerte (Intervalle von 2 Punkten)")
abline(v = schwelle, lty = 2)


# --- 4. Naiver Vergleich (Schritt 5) ---------------------------------------
mittelwerte <- tapply(daten$y, daten$d, mean)
mittelwerte
mittelwerte["1"] - mittelwerte["0"]   # rund -7,6 Stunden: vermengt Trend und Effekt


# --- 5. RDD-Schätzung mit Bandbreite h = 8 (Schritte 6 und 7) ---------------
# Lokale lineare Regression je Seite, nur Haushalte mit |x - 47,5| < 8,
# Gewichte fallen linear mit dem Abstand (Dreieckskern).
rd <- rdrobust(daten$y, daten$x, c = schwelle, h = 8)
summary(rd)   # Spalte "Point Estimate": rund -3,0 Stunden
# Hinweis: Die Warnung "Mass points detected in the running variable" ist hier
# unbedenklich. Sie erscheint, weil die Punktzahl auf 0,1 gerundet ist und viele
# Haushalte dieselbe Punktzahl haben.

# Dieselbe Schätzung ohne Paket, als gewichtete Regression:
fenster <- subset(daten, abs(x - schwelle) < 8)
fenster$abstand <- fenster$x - schwelle            # Punktzahl relativ zur Schwelle
fenster$gewicht <- 1 - abs(fenster$abstand) / 8    # Dreieckskern
modell <- lm(y ~ d * abstand, data = fenster, weights = gewicht)
coef(modell)["d"]                                  # Sprung an der Schwelle


# --- 6. Wahl der Bandbreite (Schritt 8) ------------------------------------
for (h in c(2, 5, 8, 12, 20)) {
  r <- rdrobust(daten$y, daten$x, c = schwelle, h = h)
  cat(sprintf("h = %4.1f   Haushalte: %4d   Schätzung: %6.2f Stunden\n",
              h, sum(r$N_h), r$coef[1]))
}

# Datengetriebene (MSE-optimale) Bandbreite: rund 7,7 Punkte
summary(rdbwselect(daten$y, daten$x, c = schwelle))


# --- 7. Manipulation? (Schritt 9) ------------------------------------------
# Histogramm der Punktzahl in Intervallen von 1 Punkt; 47,5 ist eine Intervallgrenze.
# Eine Häufung direkt rechts der Schwelle wäre ein Warnsignal.
hist(daten$x, breaks = seq(26.5, 70.5, by = 1),
     xlab = "Punktzahl der Begutachtung", ylab = "Haushalte",
     main = "Verteilung der Punktzahl")
abline(v = schwelle, lty = 2)
# Formaler Dichtetest (optional, weiteres Paket):
#   install.packages("rddensity"); library(rddensity)
#   summary(rddensity(daten$x, c = schwelle))


# --- 8. Placebo-Test (Schritt 10) ------------------------------------------
# Das Alter der Pflegeperson steht vor der Begutachtung fest und darf an der
# Schwelle nicht springen.
summary(rdrobust(daten$w, daten$x, c = schwelle, h = 8))
# rund 1,5 Jahre, p-Wert (Spalte "P>|z|") rund 0,23: kein signifikanter Sprung


# --- 9. Interpretation (Schritt 11) ----------------------------------------
# Die RDD-Schätzung von rund -3 Stunden ist ein lokaler Effekt: Sie gilt für
# Haushalte mit einer Punktzahl nahe 47,5.
