// .dependency-cruiser.cjs — Etappe E0-B aus docs/engineering-discipline.md
//
// Genau die zwei Regeln der Stufe 1, direkt auf `error`: B5 zeigte sie gruen,
// es gibt keinen Bestand abzutragen. Bis hierher hielt ein `grep` die
// Trennlinie — und ein `grep` auf einen Domaenennamen sieht nur die Domaenen,
// die man ihm nennt. Diese Regel sieht jede.
//
// Die fuenf wartenden Regeln (`themen.md`, „Ingenieursdisziplin einfuehren")
// stehen bewusst NICHT hier: eine Regel pro Aenderung, mit eigener Baseline
// (§5, „Kein Regel-Bulk").

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "kern-kennt-keine-domaene",
      comment:
        "Domaenenwissen gehoert nie in src/kernel/ (ADR-0002, regeln.md). " +
        "Der Kern kennt keine einzelne Domaene; die Registrierung laeuft von aussen nach innen.",
      severity: "error",
      from: { path: "^src/kernel/" },
      to: { path: "^src/domains/" },
    },
    {
      name: "kein-zyklus",
      comment:
        "Keine zyklische Abhaengigkeit — Voraussetzung dafuer, dass jede andere Pfadregel " +
        "eine Richtung hat.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    moduleSystems: ["es6"],
  },
};
