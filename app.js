/* RDD-Übung "Pflegegrad 3 und die Arbeitszeit pflegender Angehöriger".
   Daten und Lösungsschlüssel stehen in data.js, erzeugt von data/generate_data.R
   (Seed 20261118). Jeder Wert in KEY entspricht einer Zeile "KEY ..." im Log
   logs/rdd_pflegegrad_answer_key.log. Beim Laden rechnet die App alle Werte mit
   demselben Schätzer nach und prüft die Übereinstimmung (console.assert, 1e-3).
   Ausnahme: der p-Wert des Placebo-Tests (0,23) stammt aus rdrobust (Log, Schritt 10). */
"use strict";

const CUT = KEY.cutoff;          // 47,5 Punkte (Schwelle)
const H0 = KEY.hTeach;           // 8 Punkte, MSE-optimal (rdbwselect) gerundet
const STEPS_TOTAL = 11;
const STORE = "rdd-pflegegrad-schritt";

// ---------------------------------------------------------------------------
// Schätzer: lokal linear, Dreieckskern, |x - c| < h, behandelte Seite x >= c
// (identisch zu side_fit() in data/generate_data.R und zu rdrobust, p = 1)
// ---------------------------------------------------------------------------
function localLinear(rows, c, h, side, col) {
  const sel = [];
  let sw = 0, swx = 0, swy = 0;
  for (const r of rows) {
    const x = r[0], y = r[col];
    const onSide = side > 0 ? x >= c : x < c;
    const u = Math.abs(x - c) / h;
    if (!onSide || u >= 1) continue;
    const k = 1 - u, xc = x - c;
    sel.push([xc, y, k]);
    sw += k; swx += k * xc; swy += k * y;
  }
  const mx = swx / sw, my = swy / sw;
  let sxy = 0, sxx = 0;
  for (const [xc, y, k] of sel) {
    sxy += k * (xc - mx) * (y - my);
    sxx += k * (xc - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { intercept: my - slope * mx, slope, n: sel.length };
}

function rdFit(col, h) {
  const L = localLinear(DATA, CUT, h, -1, col);
  const R = localLinear(DATA, CUT, h, +1, col);
  return { L, R, est: R.intercept - L.intercept, n: L.n + R.n };
}

function sideMean(col, right) {
  let s = 0, n = 0;
  for (const r of DATA) if ((r[0] >= CUT) === right) { s += r[col]; n++; }
  return s / n;
}

// Gruppierte Mittelwerte; Intervalle an der Schwelle ausgerichtet,
// Position = mittlere Punktzahl im Intervall
function binMeans(col, bw) {
  const m = new Map();
  for (const r of DATA) {
    const k = Math.floor((r[0] - CUT) / bw + 1e-9);
    const b = m.get(k) || { sx: 0, sy: 0, n: 0 };
    b.sx += r[0]; b.sy += r[col]; b.n++;
    m.set(k, b);
  }
  return [...m.entries()]
    .filter(([, b]) => b.n >= 3)
    .map(([k, b]) => ({ x: b.sx / b.n, y: b.sy / b.n, right: k >= 0 }));
}

// Histogramm, Intervalle der Breite 1 an der Schwelle ausgerichtet,
// nur vollständig im Bereich 27 bis 70 liegende Intervalle
function histogram(xs) {
  const bins = [];
  for (let k = -20; k <= 21; k++) bins.push({ lo: CUT + k, n: 0, right: k >= 0 });
  for (const x of xs) {
    const k = Math.floor(x - CUT + 1e-9);
    if (k >= -20 && k <= 21) bins[k + 20].n++;
  }
  return bins;
}

// ---------------------------------------------------------------------------
// Selbstprüfung gegen den Lösungsschlüssel aus R
// ---------------------------------------------------------------------------
const FIT0 = rdFit(1, H0);
(function selfCheck() {
  const ml = sideMean(1, false), mr = sideMean(1, true);
  const js = {
    meanLeft: ml, meanRight: mr, naive: mr - ml,
    icptLeft: FIT0.L.intercept, icptRight: FIT0.R.intercept, rdTeach: FIT0.est,
    rdH20: rdFit(1, 20).est, placeboTeach: rdFit(2, H0).est,
  };
  let ok = true;
  for (const [k, v] of Object.entries(js)) {
    const pass = Math.abs(v - KEY[k]) < 1e-3;
    ok = ok && pass;
    console.assert(pass, `Abweichung bei ${k}: JS ${v}, R ${KEY[k]}`);
  }
  console.info(ok ? "Selbstprüfung: alle Werte stimmen mit R überein (Toleranz 1e-3)."
                  : "Selbstprüfung: ABWEICHUNG, siehe Fehlermeldungen.");
})();

// ---------------------------------------------------------------------------
// Zahlen
// ---------------------------------------------------------------------------
const fmt = (v, d = 1) =>
  v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");

function parseNum(s) {
  const t = String(s).trim().replace(/\s+/g, "").replace(/[−–]/g, "-").replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// ---------------------------------------------------------------------------
// Schritte (12 Aufgaben in 11 Schritten; Schritt 5 hat zwei Teile)
// ---------------------------------------------------------------------------
const NAIVE = fmt(KEY.naive, 1);           // −7,6
const RD = fmt(KEY.rdTeach, 1);            // −3,0
const ML = fmt(KEY.meanLeft, 1), MR = fmt(KEY.meanRight, 1);

const TASKS = [
  {
    step: 1, title: "Die Zuteilungsregel", view: "rule", mode: "numeric",
    answer: CUT, tol: 0.01, digits: 1, unit: "Punkte",
    prompt: `<p>Der Pflegegrad folgt aus der Punktzahl der Begutachtung (§&nbsp;15&nbsp;SGB&nbsp;XI):</p>
      <ul><li>Pflegegrad 2: 27 bis unter 47,5 Punkte</li>
      <li>Pflegegrad 3: 47,5 bis unter 70 Punkte</li>
      <li>Pflegegrad 4: 70 bis unter 90 Punkte</li></ul>
      <p>Der Datensatz enthält nur Haushalte mit 27 bis unter 70 Punkten.
      Bei welcher Punktzahl liegt die Schwelle zwischen Pflegegrad 2 und Pflegegrad 3?</p>`,
    success: `Richtig. Die Punktzahl der Begutachtung ist die <strong>Laufvariable</strong>,
      47,5 Punkte sind die <strong>Schwelle</strong>. Wer sie erreicht, erhält Pflegegrad 3:
      Hier entscheidet die Regel, nicht die Person.`,
    hint: "Suchen Sie in der Liste die Punktzahl, ab der Pflegegrad 3 gilt.",
  },
  {
    step: 2, title: "Wer erhält Pflegegrad 3?", view: "treatment", mode: "choice",
    prompt: `<div class="concept"><p class="concept-title">Neu: scharfes und unscharfes RDD</p>
      <p>Ein RDD nutzt eine Regel, nach der sich die Behandlung an einer Schwelle ändert. Wie
      strikt die Regel gilt, bestimmt die Art des RDD:</p>
      <ul><li><strong>Scharf:</strong> Die Regel legt die Behandlung vollständig fest. Unter
      der Schwelle wird niemand behandelt, ab der Schwelle alle. Der Anteil der Behandelten
      springt von 0 auf 1. Beispiel aus der Vorlesung: Ab 50 Jahren gilt die längere
      Bezugsdauer des Arbeitslosengeldes.</li>
      <li><strong>Unscharf:</strong> Die Schwelle verändert nur die Wahrscheinlichkeit der
      Behandlung. Beispiel: Ab der Schwelle wird eine Weiterbildung angeboten, aber nicht alle
      nehmen sie an. Der Anteil der Behandelten springt dann etwa von 0 auf 0,6.</li></ul>
      <p>Die Unterscheidung ist wichtig, weil der Sprung im Ergebnis nur im scharfen Fall
      direkt den Effekt der Behandlung misst.</p></div>
      <p>Die Grafik zeigt für jeden Haushalt, ob Pflegegrad 3 vorliegt (1) oder nicht (0).
      Welche Art von RDD liegt vor?</p>`,
    options: [
      { text: "Scharfes RDD: Unter 47,5 Punkten hat niemand Pflegegrad 3, ab 47,5 Punkten alle.", correct: true },
      { text: "Unscharfes RDD: Ab 47,5 Punkten steigt nur die Wahrscheinlichkeit für Pflegegrad 3.",
        why: "Gibt es links der Schwelle Haushalte mit Pflegegrad 3 oder rechts Haushalte ohne?" },
      { text: "Kein RDD: Der Pflegegrad hängt nicht von der Punktzahl ab.",
        why: "Achten Sie darauf, wo die Punkte von 0 auf 1 wechseln." },
    ],
    success: `Richtig. Die Regel legt den Pflegegrad vollständig fest: Der Anteil mit
      Pflegegrad 3 springt an der Schwelle von 0 auf 1. Deshalb ist der Sprung in der
      Arbeitszeit an der Schwelle direkt der geschätzte Effekt. In einem unscharfen RDD müsste
      man ihn noch durch den Sprung im Anteil der Behandelten teilen; im Beispiel oben also
      durch 0,6.`,
    hint: "Prüfen Sie, ob es links der gestrichelten Linie Punkte bei 1 oder rechts Punkte bei 0 gibt.",
  },
  {
    step: 3, title: "Die Rohdaten", view: "scatter", mode: "choice",
    prompt: `<p>Jeder Punkt ist ein Haushalt: Punktzahl der pflegebedürftigen Person und
      wöchentliche Arbeitsstunden der Hauptpflegeperson. Was erkennen Sie?</p>`,
    options: [
      { text: "Ein Sprung an der Schwelle ist auf den ersten Blick eindeutig zu sehen.",
        why: "Die einzelnen Haushalte streuen stark. Ein Sprung von wenigen Stunden geht darin leicht unter." },
      { text: "Arbeitszeit und Punktzahl hängen nicht zusammen.",
        why: "Vergleichen Sie die Höhe der Punktwolke ganz links mit der ganz rechts." },
      { text: "Mit steigender Punktzahl arbeiten Pflegepersonen im Durchschnitt weniger; ob es an der Schwelle springt, ist im Rauschen schwer zu erkennen.", correct: true },
    ],
    success: `Richtig. Die Rohdaten zeigen einen fallenden Trend und viel Streuung. Deshalb
      fasst man im RDD die Haushalte zu Mittelwerten zusammen.`,
    hint: "Vergleichen Sie die Höhe der Punktwolke links und rechts und achten Sie auf die Streuung.",
  },
  {
    step: 4, title: "Gruppierte Mittelwerte", view: "bins", mode: "choice",
    prompt: `<p>Jeder Punkt ist jetzt der Mittelwert aller Haushalte in einem Intervall der
      Punktzahl. Probieren Sie verschiedene Intervallbreiten aus. Wo verändert sich die
      Arbeitszeit sprunghaft?</p>`,
    options: [
      { text: "Bei etwa 35 Punkten", why: "Dort folgen die Mittelwerte dem Trend." },
      { text: "Bei 47,5 Punkten, also an der Schwelle", correct: true },
      { text: "Bei etwa 60 Punkten", why: "Dort folgen die Mittelwerte dem Trend." },
      { text: "Nirgends, die Arbeitszeit sinkt gleichmäßig",
        why: "Folgen Sie den Mittelwerten genau an der gestrichelten Linie." },
    ],
    success: `Richtig. Gruppierte Mittelwerte sind die Standardgrafik im RDD: Der Trend wird
      sichtbar, und an der Schwelle fällt die Arbeitszeit sprunghaft.`,
    hint: "Folgen Sie den Mittelwerten von links nach rechts. Wo liegt der nächste Punkt deutlich tiefer, als der Trend erwarten lässt?",
  },
  {
    step: 5, part: 1, title: "Der naive Vergleich", view: "naive", mode: "numeric",
    answer: KEY.naive, tol: 0.15, digits: 1, unit: "Stunden", signCheck: true,
    prompt: `<p>Die Linien zeigen die mittlere Arbeitszeit aller Haushalte links der Schwelle
      (Pflegegrad 2) und rechts der Schwelle (Pflegegrad 3). Wie groß ist die Differenz?
      Rechnen Sie <strong>rechts minus links</strong>.</p>`,
    success: `Richtig: rund ${NAIVE} Stunden. Pflegepersonen in Haushalten mit Pflegegrad 3
      arbeiten im Durchschnitt deutlich weniger. Misst das den Effekt des Pflegegrads?`,
    hint: "Lesen Sie die beiden Mittelwerte an den Linien ab und ziehen Sie den linken vom rechten ab.",
  },
  {
    step: 5, part: 2, title: "Der naive Vergleich", view: "naive", mode: "choice",
    prompt: `<p>Misst die Differenz von ${NAIVE} Stunden den Effekt von Pflegegrad 3?</p>`,
    options: [
      { text: "Nein: Rechts sind die Pflegebedürftigen im Durchschnitt pflegebedürftiger, und die Arbeitszeit sinkt schon mit der Punktzahl. Die Differenz vermengt diesen Trend mit dem Effekt des Pflegegrads.", correct: true },
      { text: "Ja, denn rechts haben alle Pflegegrad 3 und links niemand.",
        why: "Die beiden Gruppen unterscheiden sich nicht nur im Pflegegrad." },
      { text: "Nein, denn die Stichprobe ist zu klein.",
        why: "Mit 1.200 Haushalten sind die Mittelwerte präzise geschätzt. Das Problem ist nicht die Präzision." },
    ],
    success: `Richtig. Das ist <strong>Selektion</strong>: Die Gruppen unterscheiden sich auch
      ohne den Pflegegrad. Der naive Vergleich vermengt den Trend in der Punktzahl mit dem Effekt.`,
    hint: "Erinnern Sie sich an Schritt 4: Wie verläuft die Arbeitszeit innerhalb jeder Seite?",
  },
  {
    step: 6, title: "Nur nah an der Schwelle", view: "window", mode: "choice",
    prompt: `<p>Hervorgehoben sind Haushalte mit höchstens ${H0} Punkten Abstand zur Schwelle.
      Warum vergleicht das RDD nur Haushalte nahe der Schwelle?</p>`,
    options: [
      { text: "Weil dort die meisten Haushalte liegen.",
        why: "Die Punktzahlen sind etwa gleichmäßig verteilt. Das ist nicht der Grund." },
      { text: "Weil der Effekt nur dort existiert.",
        why: "Ein Effekt kann auch weiter entfernt bestehen. Glaubwürdig messen lässt er sich aber nur an der Schwelle." },
      { text: "Weil Haushalte knapp unter und knapp über 47,5 Punkten im Durchschnitt in allen anderen Merkmalen vergleichbar sind; nur der Pflegegrad unterscheidet sich.", correct: true },
    ],
    success: `Richtig. Das ist die <strong>Identifikationsannahme</strong>: Ohne die Regel
      verliefe die Arbeitszeit an der Schwelle ohne Sprung. Dann zeigen Haushalte knapp unter
      der Schwelle die <strong>kontrafaktische Situation</strong> für Haushalte knapp darüber.
      <br><br><strong>Neu: Bandbreite h.</strong> Den größten Abstand zur Schwelle, bis zu dem
      Haushalte einbezogen werden, nennt man Bandbreite h. Hier ist h&nbsp;=&nbsp;${H0}: Einbezogen werden
      Haushalte zwischen ${fmt(CUT - H0, 1)} und ${fmt(CUT + H0, 1)} Punkten. Wie man h wählt,
      sehen Sie in Schritt 8.`,
    hint: "Denken Sie an zwei Pflegebedürftige mit 47 und 48 Punkten: Worin unterscheiden sie sich?",
  },
  {
    step: 7, title: "Den Sprung schätzen", view: "fit", mode: "numeric",
    answer: KEY.rdTeach, tol: 0.5, digits: 1, unit: "Stunden", signCheck: true,
    prompt: `<div class="concept"><p class="concept-title">Neu: lokale lineare Regression</p>
      <p>Auch innerhalb des Fensters sinkt die Arbeitszeit mit der Punktzahl. Ein bloßer
      Vergleich der Mittelwerte im Fenster würde diesen Trend wieder mitmessen, wie in Schritt 5,
      nur schwächer. Deshalb legt man auf jeder Seite eine Gerade durch die Haushalte im Fenster
      und verlängert sie bis zur Schwelle. Haushalte nahe der Schwelle zählen dabei mehr, weiter
      entfernte weniger. Der Abstand der beiden Geraden genau an der Schwelle ist die RDD-Schätzung.</p></div>
      <p>Lesen Sie ab: Um wie viele Stunden springt die Arbeitszeit genau bei 47,5 Punkten?
      Rechnen Sie <strong>rechts minus links</strong>.</p>`,
    success: `Richtig: rund ${RD} Stunden. Der Abstand der beiden Geraden an der Schwelle ist
      die RDD-Schätzung, also der Effekt von Pflegegrad 3 für Haushalte an der Schwelle.
      Der naive Vergleich hatte ${NAIVE} Stunden ergeben.`,
    hint: "Lesen Sie die Höhe der orangen und der grauen Geraden genau an der gestrichelten Linie ab (Hilfslinien je Stunde). Ziehen Sie den grauen Wert vom orangen ab.",
  },
  {
    step: 8, title: "Die Bandbreite", view: "bandwidth", mode: "choice",
    prompt: `<div class="concept"><p class="concept-title">Neu: die Wahl der Bandbreite</p>
      <p>Die Bandbreite h legt fest, welche Haushalte in die Schätzung eingehen. Ihre Wahl ist
      eine Abwägung zwischen zwei Fehlern:</p>
      <ul><li><strong>Zufälliger Fehler (Varianz):</strong> Bei kleinem h gehen nur wenige
      Haushalte ein. Die Schätzung hängt dann stark davon ab, welche Haushalte zufällig im
      Fenster liegen.</li>
      <li><strong>Systematischer Fehler (Verzerrung):</strong> Bei großem h zählen auch
      Haushalte weit weg von der Schwelle. Verläuft der Zusammenhang gekrümmt, beschreibt eine
      Gerade ihn schlecht. Die Ränder ziehen die Gerade dann auch an der Schwelle in die falsche
      Richtung, und die Schätzung liegt systematisch daneben. Mehr Haushalte beheben diesen
      Fehler nicht.</li></ul></div>
      <p>Stellen Sie unter der Grafik h&nbsp;=&nbsp;2, h&nbsp;=&nbsp;${H0} und h&nbsp;=&nbsp;20 ein. Achten Sie auf die Zahl
      der Haushalte im Fenster, auf die Geraden und auf die Schätzung. Was beobachten Sie?</p>`,
    options: [
      { text: "Je größer h, desto besser: Mehr Haushalte ergeben immer eine genauere Schätzung.",
        why: "Mehr Haushalte verringern den zufälligen Fehler, nicht aber den systematischen. Achten Sie bei h&nbsp;=&nbsp;20 darauf, wie gut die Geraden den Punkten an den Rändern folgen." },
      { text: `Bei h&nbsp;=&nbsp;2 liegen nur wenige Haushalte im Fenster, und die Schätzung weicht deutlich von den anderen ab (zufälliger Fehler). Bei h&nbsp;=&nbsp;20 folgen die Geraden dem gekrümmten Verlauf an den Rändern nicht mehr (systematischer Fehler). h&nbsp;=&nbsp;${H0} liegt dazwischen.`, correct: true },
      { text: "Die Schätzung ist bei allen Bandbreiten gleich; die Wahl von h spielt keine Rolle.",
        why: "Vergleichen Sie die Schätzung unter der Grafik bei h&nbsp;=&nbsp;2 und bei h&nbsp;=&nbsp;20." },
    ],
    success: `Richtig. Die Wahl von h ist eine Abwägung zwischen zufälligem und systematischem
      Fehler. In der Praxis wählt man h mit einem Verfahren, das beide Fehler zusammen möglichst
      klein hält; hier ergibt es rund ${H0} Punkte. Zusätzlich berichtet man Ergebnisse für mehrere Bandbreiten:
      Ein glaubwürdiger Effekt sollte nicht an einer bestimmten Wahl von h hängen.`,
    hint: "Vergleichen Sie Zahl der Haushalte und Schätzung bei h&nbsp;=&nbsp;2, h&nbsp;=&nbsp;8 und h&nbsp;=&nbsp;20. Wo weicht die Schätzung stark ab, wo liegen die Punkte an den Rändern deutlich neben den Geraden?",
  },
  {
    step: 9, title: "Manipulation?", view: "density", mode: "choice",
    prompt: `<p>Die Balken zeigen, wie viele Haushalte je Punkt-Intervall begutachtet wurden.
      Szenario A zeigt unsere Daten. In Szenario B wurde ein Teil der Haushalte knapp unter
      der Schwelle über die Schwelle gehoben. Welches Szenario gefährdet die Identifikation?</p>`,
    options: [
      { text: "Keines, die Verteilung der Punktzahl spielt keine Rolle.",
        why: "Wer gezielt über die Schwelle gelangt, unterscheidet sich vermutlich auch in anderen Merkmalen." },
      { text: "Szenario A", why: "In Szenario A ist die Verteilung an der Schwelle glatt." },
      { text: "Szenario B: Die Häufung knapp über 47,5 Punkten zeigt, dass Punktzahlen gezielt über die Schwelle gesteuert wurden. Haushalte knapp darüber sind dann nicht mehr mit Haushalten knapp darunter vergleichbar.", correct: true },
    ],
    success: `Richtig. Eine Häufung knapp über der Schwelle ist ein Warnsignal für
      <strong>Manipulation der Laufvariable</strong>. Formal prüft man das mit einem
      Dichtetest (McCrary 2008; Cattaneo, Jansson und Ma 2020).`,
    hint: "Schalten Sie zwischen A und B um und vergleichen Sie die Balken direkt links und rechts der Schwelle.",
  },
  {
    step: 10, title: "Placebo-Test", view: "placebo", mode: "choice",
    prompt: `<p>Das Alter der Pflegeperson steht schon vor der Begutachtung fest; der
      Pflegegrad kann es nicht beeinflussen. Was sollte ein gültiges RDD hier zeigen, und
      was zeigt die Grafik?</p>`,
    options: [
      { text: "Keinen deutlichen Sprung; die kleine Lücke zwischen den Geraden liegt im Rahmen des Zufalls.", correct: true },
      { text: "Einen deutlichen Sprung an der Schwelle, wie bei der Arbeitszeit.",
        why: "Ein Sprung in einem vorab feststehenden Merkmal wäre ein Warnsignal, keine Bestätigung." },
      { text: "Das Alter ist der eigentliche Grund für den Sprung in der Arbeitszeit.",
        why: "Das Alter ist an der Schwelle stetig; es kann den Sprung nicht erklären." },
    ],
    success: `Richtig. Vorab feststehende Merkmale dürfen an der Schwelle nicht springen.
      Hier beträgt die Lücke rund ${fmt(KEY.placeboTeach, 1)} Jahre und ist statistisch nicht
      signifikant (p ≈ 0,23). Das stützt die Identifikationsannahme, beweist sie aber nicht.`,
    hint: "Vergleichen Sie die Lücke zwischen den Geraden mit der Streuung der Mittelwerte.",
  },
  {
    step: 11, title: "Was haben wir geschätzt?", view: "final", mode: "choice",
    prompt: `<p>Die RDD-Schätzung beträgt rund ${RD} Stunden pro Woche. Wie ist sie zu
      interpretieren?</p>`,
    options: [
      { text: "Pflegegrad 3 senkt die Arbeitszeit aller pflegenden Angehörigen um rund 3 Stunden.",
        why: "Die Schätzung stammt nur aus Haushalten nahe der Schwelle." },
      { text: "Für Haushalte mit einer Punktzahl nahe 47,5 senkt Pflegegrad 3 statt 2 die Arbeitszeit der Hauptpflegeperson um rund 3 Stunden pro Woche.", correct: true },
      { text: "Höhere Pflegebedürftigkeit senkt die Arbeitszeit um rund 3 Stunden.",
        why: "Die Pflegebedürftigkeit ändert sich an der Schwelle stetig. Gemessen wird der Effekt des Pflegegrads, also der Regel." },
    ],
    success: `Richtig. Das RDD schätzt einen <strong>lokalen Effekt an der Schwelle</strong>.
      Im simulierten Datensatz beträgt der wahre Effekt ${fmt(KEY.tauTrue, 0)} Stunden.
      Geschafft! Im Kasten unten finden Sie die Rohdaten und ein R-Skript, mit dem Sie alle
      Schritte selbst nachrechnen können.`,
    hint: "Für wen gilt die Schätzung? Nur Haushalte nahe der Schwelle liefern die Information.",
  },
];

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------
// furthest: am weitesten erreichte Aufgabe. Alle Aufgaben davor sind gelöst (man kommt nur
// durch Lösen weiter); "Zurück" zeigt sie deshalb gelöst an. done: Antworten dieser Sitzung.
const state = {
  task: 0, attempts: 0, solved: false, selected: null, input: "",
  feedback: null, bw: 2, h: H0, scen: "A", furthest: 0, done: {},
};
const STORE_MAX = "rdd-pflegegrad-weitester";

function goTo(i, focus = true) {
  const t = TASKS[i];
  state.task = i;
  state.furthest = Math.max(state.furthest, i);
  state.attempts = 0;
  let rec = state.done[i];
  if (!rec && i < state.furthest) {
    // gelöst, aber Antwort nicht mehr im Speicher (nach Neuladen): richtige Antwort zeigen
    rec = { viaSolution: false,
      selected: t.mode === "choice" ? t.options.findIndex((o) => o.correct) : null,
      input: t.mode === "numeric" ? fmt(t.answer, t.digits) : "" };
  }
  state.solved = Boolean(rec);
  state.selected = rec ? rec.selected : null;
  state.input = rec ? rec.input : "";
  state.feedback = rec ? { kind: "ok", html: (rec.viaSolution ? "<strong>Lösung:</strong> " : "") + t.success } : null;
  try {
    localStorage.setItem(STORE, String(i));
    localStorage.setItem(STORE_MAX, String(state.furthest));
  } catch (e) { /* ohne Speicher weiter */ }
  render();
  if (focus) document.getElementById("step-title").focus({ preventScroll: true });
}

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Ablauf: Prüfen, Lösung, Weiter
// ---------------------------------------------------------------------------
function onMain() {
  if (state.solved) {
    if (state.task < TASKS.length - 1) goTo(state.task + 1);
    return;
  }
  check(TASKS[state.task]);
}

function check(t) {
  let ok = false, msg = "";
  if (t.mode === "numeric") {
    const v = parseNum(state.input);
    if (Number.isNaN(v)) {
      state.feedback = { kind: "info", html: "Bitte geben Sie eine Zahl ein. Ein Dezimalkomma ist erlaubt, zum Beispiel 12,5." };
      render();
      return;
    }
    ok = Math.abs(v - t.answer) <= t.tol;
    if (!ok) {
      msg = t.signCheck && Math.abs(-v - t.answer) <= t.tol
        ? "Fast. Prüfen Sie das Vorzeichen: Rechnen Sie rechts minus links."
        : "Noch nicht richtig.";
    }
  } else {
    if (state.selected === null) {
      state.feedback = { kind: "info", html: "Bitte wählen Sie eine Antwort aus." };
      render();
      return;
    }
    const o = t.options[state.selected];
    ok = Boolean(o.correct);
    if (!ok) msg = "Noch nicht. " + (o.why || "");
  }
  if (ok) {
    solve(false);
    return;
  }
  state.attempts++;
  const rest = 3 - state.attempts;
  state.feedback = {
    kind: "bad",
    html: msg + (rest > 0 ? ` <span class="muted">(${state.attempts}. Versuch)</span>` : ""),
  };
  render();
}

function solve(viaSolution) {
  const t = TASKS[state.task];
  if (viaSolution) {
    if (t.mode === "numeric") state.input = fmt(t.answer, t.digits);
    else state.selected = t.options.findIndex((o) => o.correct);
  }
  state.solved = true;
  state.done[state.task] = { selected: state.selected, input: state.input, viaSolution };
  state.feedback = { kind: "ok", html: (viaSolution ? "<strong>Lösung:</strong> " : "") + t.success };
  render();
}

// ---------------------------------------------------------------------------
// Darstellung: Text und Antwortfeld
// ---------------------------------------------------------------------------
function render() {
  const t = TASKS[state.task];
  const last = state.task === TASKS.length - 1;
  $("progress-label").textContent =
    `Schritt ${t.step} von ${STEPS_TOTAL}` + (t.part ? ` · Teil ${t.part} von 2` : "");
  const done = t.step - 1 + (state.solved && (!t.part || t.part === 2) ? 1 : 0);
  $("progress-fill").style.width = `${(done / STEPS_TOTAL) * 100}%`;
  $("step-title").textContent = t.title;
  $("step-title").setAttribute("tabindex", "-1");
  $("prompt").innerHTML = t.prompt;
  renderAnswer(t);

  const fb = $("feedback");
  if (state.feedback) {
    fb.hidden = false;
    fb.className = `feedback ${state.feedback.kind}`;
    fb.innerHTML = state.feedback.html;
  } else {
    fb.hidden = true;
  }
  const showHelp = !state.solved && state.attempts >= 3;
  $("hint").hidden = !showHelp;
  $("hint").innerHTML = `<strong>Hinweis:</strong> ${t.hint}`;
  $("btn-solution").hidden = !showHelp;

  const main = $("btn-main");
  main.disabled = state.solved && last;
  main.textContent = !state.solved ? "Prüfen" : last ? "Geschafft" : "Weiter";

  // Kasten "Selbst nachrechnen in R" nur im letzten Schritt
  $("selfrun").hidden = !last;

  renderControls(t);
  drawChart();
}

function renderAnswer(t) {
  const box = $("answer");
  box.classList.toggle("locked", state.solved);
  const dis = state.solved ? "disabled" : "";
  if (t.mode === "numeric") {
    box.innerHTML = `<label class="num-row" for="num">Ihre Antwort:
      <input id="num" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
        value="${esc(state.input)}" ${dis}> <span>${t.unit}</span></label>`;
    const inp = $("num");
    inp.addEventListener("input", (e) => { state.input = e.target.value; });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); onMain(); }
    });
  } else {
    box.innerHTML = `<fieldset class="options"><legend class="sr-only">Antwortmöglichkeiten</legend>${
      t.options.map((o, i) => `<label class="option${state.solved && o.correct ? " is-correct" : ""}">
        <input type="radio" name="opt" value="${i}" ${state.selected === i ? "checked" : ""} ${dis}>
        <span>${o.text}</span></label>`).join("")}</fieldset>`;
    box.querySelectorAll('input[name="opt"]').forEach((r) =>
      r.addEventListener("change", (e) => { state.selected = Number(e.target.value); }));
  }
}

// ---------------------------------------------------------------------------
// Bedienelemente unter der Grafik
// ---------------------------------------------------------------------------
function renderControls(t) {
  const c = $("controls");
  if (t.view === "bins") {
    c.innerHTML = `<span class="label">Intervallbreite:</span>${[1, 2, 4].map((b) =>
      `<button type="button" class="toggle" data-bw="${b}" aria-pressed="${state.bw === b}">${b} ${b === 1 ? "Punkt" : "Punkte"}</button>`).join("")}`;
    c.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.bw = Number(b.dataset.bw);
      renderControls(t);
      drawChart();
    }));
  } else if (t.view === "bandwidth") {
    // Schnellwahl h = 2 / 8 / 20 (auf dem Handy leichter als der Regler) und Regler
    c.innerHTML = `<span class="label">Bandbreite h:</span>${[2, H0, 20].map((h) =>
      `<button type="button" class="toggle" data-h="${h}" aria-pressed="${state.h === h}">h = ${h}</button>`).join("")}
      <div class="slider-row"><label class="label" for="hslider">stufenlos</label>
      <input id="hslider" type="range" min="2" max="20" step="0.5" value="${state.h}"
        aria-describedby="readout"></div><p id="readout" class="readout"></p>`;
    const syncPresets = () => c.querySelectorAll("button[data-h]").forEach((b) =>
      b.setAttribute("aria-pressed", String(Number(b.dataset.h) === state.h)));
    $("hslider").addEventListener("input", (e) => {
      state.h = Number(e.target.value);
      syncPresets();
      updateBandwidth();
    });
    c.querySelectorAll("button[data-h]").forEach((b) => b.addEventListener("click", () => {
      state.h = Number(b.dataset.h);
      $("hslider").value = String(state.h);
      syncPresets();
      updateBandwidth();
    }));
  } else if (t.view === "density") {
    c.innerHTML = `<span class="label">Szenario:</span>${[["A", "A: unsere Daten"], ["B", "B: Häufung"]].map(([k, l]) =>
      `<button type="button" class="toggle" data-s="${k}" aria-pressed="${state.scen === k}">${l}</button>`).join("")}`;
    c.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.scen = b.dataset.s;
      renderControls(t);
      drawChart();
    }));
  } else {
    c.innerHTML = "";
  }
}

// ---------------------------------------------------------------------------
// Grafik (SVG, viewBox 600 x 420)
// ---------------------------------------------------------------------------
const VW = 600, VH = 420;
const M = { l: 64, r: 14, t: 16, b: 62 };
const X0 = M.l, X1 = VW - M.r, Y0 = M.t, Y1 = VH - M.b;
const XDOM = [26, 71];
let YDOM = [0, 45];
const sx = (x) => +(X0 + ((x - XDOM[0]) / (XDOM[1] - XDOM[0])) * (X1 - X0)).toFixed(1);
const sy = (y) => +(Y1 - ((y - YDOM[0]) / (YDOM[1] - YDOM[0])) * (Y1 - Y0)).toFixed(1);
const C = { left: "#7a7a7a", leftDark: "#4f4f4f", right: "#eb811b", rightDark: "#c86e17", cut: "#4d4d4d" };
const HALO = 'paint-order="stroke" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"';

function axes(o) {
  let s = "";
  if (o.yFine) {
    for (let v = Math.ceil(YDOM[0]); v <= YDOM[1]; v += o.yFine) {
      s += `<line x1="${X0}" x2="${X1}" y1="${sy(v)}" y2="${sy(v)}" stroke="#f0f0f0"/>`;
    }
  }
  if (o.yTicks) {
    for (const v of o.yTicks) {
      s += `<line x1="${X0}" x2="${X1}" y1="${sy(v)}" y2="${sy(v)}" stroke="#dedede"/>`;
      s += `<text x="${X0 - 8}" y="${sy(v) + 5}" text-anchor="end" font-size="16" fill="#555">${o.yFmt ? o.yFmt(v) : fmt(v, 0)}</text>`;
    }
    s += `<line x1="${X0}" x2="${X0}" y1="${Y0}" y2="${Y1}" stroke="#555"/>`;
    s += `<text transform="translate(18 ${(Y0 + Y1) / 2}) rotate(-90)" text-anchor="middle" font-size="16" fill="#444">${o.yLabel}</text>`;
  }
  s += `<line x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}" stroke="#555"/>`;
  const xt = o.showCut ? [30, 35, 40, CUT, 55, 60, 65, 70] : [30, 35, 40, 45, 50, 55, 60, 65, 70];
  for (const v of xt) {
    const isCut = v === CUT;
    s += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${Y1}" y2="${Y1 + 6}" stroke="#555"/>`;
    s += `<text x="${sx(v)}" y="${Y1 + 24}" text-anchor="middle" font-size="16" fill="${isCut ? "#1d1d1b" : "#555"}" ${isCut ? 'font-weight="700"' : ""}>${fmt(v, isCut ? 1 : 0)}</text>`;
  }
  s += `<text x="${(X0 + X1) / 2}" y="${VH - 10}" text-anchor="middle" font-size="16" fill="#444">Punktzahl der Begutachtung (Laufvariable)</text>`;
  return s;
}

function cutLine() {
  return `<line x1="${sx(CUT)}" x2="${sx(CUT)}" y1="${Y0}" y2="${Y1}" stroke="${C.cut}" stroke-width="1.6" stroke-dasharray="6 5"/>`;
}

function groupLabels() {
  const y = Y0 + 18;
  return `<text x="${sx(37.25)}" y="${y}" text-anchor="middle" font-size="16" fill="${C.leftDark}" ${HALO}>Pflegegrad 2</text>
    <text x="${sx(58.75)}" y="${y}" text-anchor="middle" font-size="16" font-weight="700" fill="${C.rightDark}" ${HALO}>Pflegegrad 3</text>`;
}

function dots(pts, r, op) {
  let s = "";
  for (const p of pts) {
    s += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${r}" fill="${p.right ? C.right : C.left}" fill-opacity="${p.op ?? op}"/>`;
  }
  return s;
}

function fitLines(col, h, opts = {}) {
  const f = rdFit(col, h);
  const xl = Math.max(27, CUT - h), xr = Math.min(70, CUT + h);
  const yL = (x) => f.L.intercept + f.L.slope * (x - CUT);
  const yR = (x) => f.R.intercept + f.R.slope * (x - CUT);
  let s = "";
  if (opts.guides) {
    for (const [v, col2] of [[f.L.intercept, C.leftDark], [f.R.intercept, C.rightDark]]) {
      s += `<line x1="${X0}" x2="${sx(CUT)}" y1="${sy(v)}" y2="${sy(v)}" stroke="${col2}" stroke-width="1.2" stroke-dasharray="2 4"/>`;
    }
  }
  s += `<line x1="${sx(xl)}" y1="${sy(yL(xl))}" x2="${sx(CUT)}" y2="${sy(f.L.intercept)}" stroke="${C.leftDark}" stroke-width="3.5" stroke-linecap="round"/>`;
  s += `<line x1="${sx(CUT)}" y1="${sy(f.R.intercept)}" x2="${sx(xr)}" y2="${sy(yR(xr))}" stroke="${C.rightDark}" stroke-width="3.5" stroke-linecap="round"/>`;
  if (opts.ends) {
    s += `<circle cx="${sx(CUT)}" cy="${sy(f.L.intercept)}" r="5.5" fill="#fff" stroke="${C.leftDark}" stroke-width="2.5"/>`;
    s += `<circle cx="${sx(CUT)}" cy="${sy(f.R.intercept)}" r="5.5" fill="${C.right}" stroke="${C.rightDark}" stroke-width="2.5"/>`;
  }
  return s;
}

function windowRect(h, label) {
  const xl = Math.max(27, CUT - h), xr = Math.min(70, CUT + h);
  let s = `<rect x="${sx(xl)}" y="${Y0}" width="${(sx(xr) - sx(xl)).toFixed(1)}" height="${Y1 - Y0}" fill="#fdf1e4"/>`;
  if (label) {
    s += `<text x="${sx(CUT)}" y="${Y1 - 12}" text-anchor="middle" font-size="15" fill="${C.rightDark}" ${HALO}>Fenster: ±${fmt(h, h % 1 ? 1 : 0)} Punkte</text>`;
  }
  return s;
}

const HOURS = { yLabel: "Arbeitsstunden pro Woche" };
const RAW = DATA.map((r) => ({ x: r[0], y: r[1], right: r[0] >= CUT }));

function drawChart() {
  const t = TASKS[state.task];
  const v = t.view;
  const showCut = !(v === "rule" && !state.solved);
  let back = "", data = "", fit = "", front = "", ax, note = "";

  if (v === "rule") {
    YDOM = [0, 1];
    ax = axes({ showCut });
    if (state.solved) {
      back = `<rect x="${sx(27)}" y="${Y0}" width="${sx(CUT) - sx(27)}" height="${Y1 - Y0}" fill="#efefef"/>
        <rect x="${sx(CUT)}" y="${Y0}" width="${sx(70) - sx(CUT)}" height="${Y1 - Y0}" fill="#fdf0e2"/>`;
      front = `<text x="${sx(37.25)}" y="${(Y0 + Y1) / 2}" text-anchor="middle" font-size="22" fill="${C.leftDark}">Pflegegrad 2</text>
        <text x="${sx(58.75)}" y="${(Y0 + Y1) / 2}" text-anchor="middle" font-size="22" font-weight="700" fill="${C.rightDark}">Pflegegrad 3</text>
        ${cutLine()}`;
    } else {
      back = `<rect x="${sx(27)}" y="${Y0}" width="${sx(70) - sx(27)}" height="${Y1 - Y0}" fill="#f4f4f2"/>`;
      front = `<text x="${sx(48.5)}" y="${(Y0 + Y1) / 2}" text-anchor="middle" font-size="18" fill="#666">Stichprobe: 27 bis unter 70 Punkte</text>`;
    }
    note = "Laufvariable: Punktzahl der Begutachtung (0 bis 100). Gezeigt ist der Bereich der Stichprobe.";
  } else if (v === "treatment") {
    YDOM = [-0.3, 1.3];
    ax = axes({ showCut, yTicks: [0, 1], yLabel: "Pflegegrad 3 (1 = ja)" });
    const pts = DATA.map((r, i) => {
      const d = r[0] >= CUT ? 1 : 0;
      const j = (((i * 7919) % 101) / 101 - 0.5) * 0.16;
      return { x: r[0], y: d + j, right: d === 1 };
    });
    data = dots(pts, 2.4, 0.55);
    front = cutLine() + groupLabels();
    note = "Jeder Punkt ein Haushalt, senkrecht leicht gestreut, damit die Punkte sichtbar bleiben.";
  } else if (v === "scatter" || v === "naive" || v === "window") {
    YDOM = [0, 45];
    ax = axes({ showCut, yTicks: [0, 10, 20, 30, 40], ...HOURS });
    if (v === "scatter") {
      data = dots(RAW, 2.3, 0.5);
      note = "Jeder Punkt ein Haushalt.";
    } else if (v === "naive") {
      data = dots(RAW, 2.3, 0.2);
      const yl = sy(KEY.meanLeft), yr = sy(KEY.meanRight);
      fit = `<line x1="${sx(27)}" x2="${sx(CUT)}" y1="${yl}" y2="${yl}" stroke="${C.leftDark}" stroke-width="4"/>
        <line x1="${sx(CUT)}" x2="${sx(70)}" y1="${yr}" y2="${yr}" stroke="${C.rightDark}" stroke-width="4"/>
        <text x="${sx(37.25)}" y="${yl - 12}" text-anchor="middle" font-size="17" font-weight="700" fill="${C.leftDark}" ${HALO}>Mittelwert: ${ML} Std.</text>
        <text x="${sx(58.75)}" y="${yr - 12}" text-anchor="middle" font-size="17" font-weight="700" fill="${C.rightDark}" ${HALO}>Mittelwert: ${MR} Std.</text>`;
      note = "Linien: mittlere Arbeitszeit aller Haushalte links bzw. rechts der Schwelle.";
    } else {
      back = windowRect(H0, false);
      data = dots(RAW.map((p) => ({ ...p, op: Math.abs(p.x - CUT) < H0 ? 0.8 : 0.12 })), 2.3, 0.5);
      front = `<text x="${sx(CUT)}" y="${Y1 - 12}" text-anchor="middle" font-size="15" fill="${C.rightDark}" ${HALO}>Fenster: ±${H0} Punkte</text>`;
      note = `Hervorgehoben: Haushalte mit höchstens ${H0} Punkten Abstand zur Schwelle.`;
    }
    front = cutLine() + groupLabels() + front;
  } else if (v === "bins") {
    YDOM = [14, 32];
    ax = axes({ showCut, yTicks: [15, 20, 25, 30], ...HOURS });
    data = dots(binMeans(1, state.bw), 4.6, 0.9);
    front = cutLine() + groupLabels();
    note = "Jeder Punkt: Mittelwert aller Haushalte in einem Intervall. Die y-Achse zeigt nur 14 bis 32 Stunden.";
  } else if (v === "fit" || v === "bandwidth" || v === "final") {
    YDOM = [14, 32];
    ax = axes({ showCut, yTicks: [15, 20, 25, 30], yFine: v === "fit" ? 1 : 0, ...HOURS });
    data = dots(binMeans(1, 1), 3.6, 0.45);
    if (v === "fit") {
      back = windowRect(H0, false);
      fit = fitLines(1, H0, { guides: true, ends: true });
      note = `Geraden: lokal lineare Regression je Seite, Bandbreite ${H0} Punkte. Hellgraue Hilfslinien je Stunde.`;
    } else if (v === "bandwidth") {
      back = `<g id="layer-window">${windowRect(state.h, true)}</g>`;
      fit = fitLines(1, state.h, { ends: true });
      note = "Fenster und Geraden folgen dem Schieberegler. Punkte: Mittelwerte je Punkt.";
    } else {
      back = windowRect(H0, false);
      fit = fitLines(1, H0, { ends: true });
      const a = sy(FIT0.L.intercept), b = sy(FIT0.R.intercept), bx = sx(CUT) + 12;
      front = `<path d="M${bx - 5} ${a} H${bx} V${b} H${bx - 5}" fill="none" stroke="${C.rightDark}" stroke-width="2"/>
        <line x1="${bx}" y1="${((a + b) / 2).toFixed(1)}" x2="${sx(CUT + 2.2)}" y2="${sy(15.6)}" stroke="${C.rightDark}" stroke-width="1.5"/>
        <text x="${sx(CUT + 2.4)}" y="${sy(15.2)}" font-size="17" font-weight="700" fill="${C.rightDark}" ${HALO}>Sprung: ${RD} Std.</text>`;
      note = `Bandbreite ${H0} Punkte. Punkte: Mittelwerte je Punkt.`;
    }
    front = cutLine() + groupLabels() + front;
  } else if (v === "density") {
    YDOM = [0, 60];
    ax = axes({ showCut, yTicks: [0, 20, 40, 60], yLabel: "Haushalte je Punkt" });
    const bins = histogram(state.scen === "A" ? DATA.map((r) => r[0]) : DATA_B_X);
    for (const b of bins) {
      const x0 = sx(b.lo) + 0.6, w = (sx(b.lo + 1) - sx(b.lo) - 1.2).toFixed(1);
      data += `<rect x="${x0}" y="${sy(b.n)}" width="${w}" height="${(Y1 - sy(b.n)).toFixed(1)}" fill="${b.right ? C.right : C.left}" fill-opacity="0.8"/>`;
    }
    front = cutLine() + groupLabels();
    note = state.scen === "A"
      ? "Szenario A: unsere Daten. Balken: Zahl der Haushalte je Intervall von einem Punkt."
      : "Szenario B: Ein Teil der Haushalte knapp unter der Schwelle wurde über die Schwelle gehoben.";
  } else if (v === "placebo") {
    YDOM = [36, 68];
    ax = axes({ showCut, yTicks: [40, 45, 50, 55, 60, 65], yLabel: "Alter der Pflegeperson (Jahre)" });
    data = dots(binMeans(2, 2), 4.2, 0.85);
    back = windowRect(H0, false);
    fit = fitLines(2, H0, { ends: true });
    front = cutLine() + groupLabels();
    note = `Punkte: mittleres Alter je 2 Punkte. Geraden: wie in Schritt 7, Bandbreite ${H0} Punkte.`;
  }

  $("chart").innerHTML = `${back}${ax}<g id="layer-points">${data}</g><g id="layer-fit">${fit}</g>${front}`;
  $("chart-note").textContent = note;
  if (v === "bandwidth") updateReadout();
}

// Schieberegler: nur Fenster, Geraden und Anzeige neu zeichnen
function updateBandwidth() {
  $("layer-window").innerHTML = windowRect(state.h, true);
  $("layer-fit").innerHTML = fitLines(1, state.h, { ends: true });
  updateReadout();
}

function updateReadout() {
  const f = rdFit(1, state.h);
  $("readout").textContent =
    `h = ${fmt(state.h, 1)} Punkte · Haushalte im Fenster: ${f.n.toLocaleString("de-DE")} · geschätzter Sprung: ${fmt(f.est, 2)} Std.`;
}

// ---------------------------------------------------------------------------
// Startseite (Kontext, Daten, Lernziele): beim ersten Aufruf und nach "Von vorn".
// Wer schon begonnen hat, landet direkt beim gespeicherten Schritt.
// ---------------------------------------------------------------------------
function showIntro(on, focus) {
  $("intro").hidden = !on;
  document.querySelector(".layout").hidden = on;
  document.body.classList.toggle("is-intro", on);
  if (on && focus) $("intro-title").focus({ preventScroll: true });
}

$("btn-start").addEventListener("click", () => {
  showIntro(false);
  window.scrollTo(0, 0);
  goTo(0);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
$("btn-main").addEventListener("click", onMain);
$("btn-solution").addEventListener("click", () => solve(true));

// Zurück: zur vorigen Aufgabe; von Schritt 1 zur Startseite
$("btn-back").addEventListener("click", () => {
  if (state.task === 0) {
    showIntro(true, true);
    window.scrollTo(0, 0);
  } else {
    goTo(state.task - 1);
  }
});

$("btn-reset").addEventListener("click", () => {
  if (state.furthest === 0 || window.confirm("Übung von vorn beginnen? Ihre Antworten werden gelöscht.")) {
    state.bw = 2; state.h = H0; state.scen = "A";
    state.furthest = 0; state.done = {};
    goTo(0);
    try {
      localStorage.removeItem(STORE);
      localStorage.removeItem(STORE_MAX);
    } catch (e) { /* ohne Speicher weiter */ }
    showIntro(true, true);
    window.scrollTo(0, 0);
  }
});

const readIdx = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const s = Number(raw);
    return raw !== null && Number.isInteger(s) && s >= 0 && s < TASKS.length ? s : null;
  } catch (e) { return null; }  // ohne Speicher: Startseite
};
const start = readIdx(STORE);
if (start === null) {
  state.task = 0;
  render();
  showIntro(true, false);
} else {
  state.furthest = Math.max(readIdx(STORE_MAX) ?? 0, start);
  goTo(start, false);
  showIntro(false);
}
