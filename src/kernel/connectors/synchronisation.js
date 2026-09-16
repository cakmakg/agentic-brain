// ── kernel/connectors/synchronisation.js ─────────────────────────────────
// Ein Synchronisationszyklus: Momentaufnahme holen, chunken, die ganze Quelle
// im Speicher ersetzen (ADR-0011).
//
// Diese Datei ist der Grund, warum Metrik 3.14 überhaupt eine Zahl über die
// STRUKTUR ist und nicht über die Sorgfalt eines Diffs. Sie hat keinen Zweig
// für „gelöscht" und keinen für „Berechtigung geändert" — beides fällt aus
// dem Ersetzen heraus, ohne dass es eigens behandelt würde:
//
//   Dokument nicht mehr in der Momentaufnahme  → es liegt danach nicht im Speicher
//   Berechtigung enger geworden               → es kommt mit der neuen Envelope zurück
//
// REIHENFOLGE, UND SIE IST DIE AUSSAGE. Erst wird die VOLLSTÄNDIGE neue
// Chunkliste gebaut, dann ersetzt. `verarbeiteDokument` wirft bei einer
// unvollständigen Envelope — passiert das, ist nichts ersetzt und der alte
// Stand steht unverändert.
//
// Der eingehandelte Preis, ausdrücklich: der alte Stand kann eine
// Berechtigung tragen, die es in der Quelle nicht mehr gibt. Eine
// fehlgeschlagene Synchronisation ist deshalb KEIN Randfall, den ein Aufrufer
// wegfangen darf — sie wirft, und sie wirft absichtlich weiter. Wer sie
// schluckt, behält alte Berechtigungen und merkt es an nichts.

import { verarbeiteDokument } from "../context/ingest/pipeline.js";

export async function synchronisiere(store, connector) {
  const dokumente = connector.hole();

  const chunks = [];
  for (const dok of dokumente) {
    // Kein try/catch. Siehe oben: still weiterlaufen hieße hier, eine
    // zurückgenommene Berechtigung stehen zu lassen.
    for (const chunk of await verarbeiteDokument(dok, store.embedding)) {
      chunks.push(chunk);
    }
  }

  const { entfernt, geschrieben } = await store.ersetzeQuelle(
    connector.quelle,
    chunks,
  );

  return {
    quelle: connector.quelle,
    dokumente: dokumente.length,
    chunks: chunks.length,
    entfernt,
    geschrieben,
  };
}
