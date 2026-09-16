// ── kernel/context/embedding/index.js ────────────────────────────────────
// DER PORT DES EMBEDDINGS. Er beschreibt, was ein Einbettungsverfahren können
// muss, und prüft, dass ein übergebener Adapter es kann. Er weiß nicht,
// WELCHE Adapter es gibt.
//
// WARUM EIN PORT UND NICHT EIN AUSTAUSCH (ADR-0015). ADR-0007 klang, als
// würde Etappe 3 den Hash gegen „ein echtes Modell" tauschen. Das geht nicht:
// ein echtes Embedding kostet Geld, braucht einen Schlüssel und antwortet
// über ein Netz. Genau die drei Eigenschaften, wegen derer Schicht A überhaupt
// etwas beweist — deterministisch, kostenlos, in CI —, wären damit weg. Also
// dieselbe Antwort wie beim Chunk-Speicher (ADR-0006, ADR-0013): ein Port mit
// zwei Adaptern. `hash` bleibt die Voreinstellung und trägt Schicht A und K5
// allein; ein echtes Modell tritt DANEBEN und wird ausdrücklich verlangt.
//
// DER PORT IST ASYNCHRON, auch wenn der Hash synchron rechnet. Ein Modell
// hinter einem Netz kann nicht synchron antworten — dieselbe Begründung wie
// beim Store-Port in Etappe 3c, und wie dort wurde die Umstellung VOR dem
// zweiten Adapter gemacht, mit dem Tor „alle Zahlen identisch".
//
// STAPELWEISE, NICHT EINZELN. `einbetteViele` ist die Pflichtmethode, nicht
// `einbette`. Ein Modell je Chunk einzeln zu fragen wäre bei einem Dokument
// mit zehn Chunks zehn Netzaufrufe — und die Anbieter rechnen ohnehin je
// Aufruf ab. Der Einzelfall ist der Sonderfall, nicht umgekehrt.

// ── Die zwei Arten von Text ──────────────────────────────────────────────
// Ein echtes Retrieval-Embedding ist ASYMMETRISCH: dieselbe Zeichenkette wird
// als Frage anders eingebettet als als Dokument, weil die Frage nach etwas
// sucht und das Dokument etwas enthält. Der Hash kennt diesen Unterschied
// nicht (er ist symmetrisch) — aber der Port muss ihn kennen, sonst kann kein
// Adapter ihn je ausdrücken.
//
// Das ist der einzige Punkt, an dem dieser Port mehr verlangt, als der
// bisherige Hash brauchte. Er steht hier, weil er sich später nicht
// nachrüsten ließe, ohne jeden Aufrufer anzufassen.
export const ARTEN = ["dokument", "anfrage"];

// ── Die lexikalische Zerlegung ───────────────────────────────────────────
// Sie gehört NICHT zu einem Adapter. Der Stichwortpfad der hybriden Suche
// benutzt sie, und er darf sich nicht ändern, wenn der Vektorpfad wechselt —
// sonst wäre bei einem Adaptertausch nicht mehr zuzuordnen, welcher der
// beiden Pfade eine Zahl bewegt hat.
//
// Zwei Zerlegungen wären zwei Vorstellungen davon, was ein Wort ist, und die
// Suche fände Begriffe, die das Embedding nie gesehen hat.
export function terme(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

const PFLICHTFELDER = ["name", "dimensionen", "einbetteViele"];

export function createEmbedding(adapter) {
  for (const feld of PFLICHTFELDER) {
    if (adapter?.[feld] === undefined) {
      throw new Error(
        `createEmbedding: der Adapter liefert kein Feld "${feld}".`,
      );
    }
  }
  if (typeof adapter.einbetteViele !== "function") {
    throw new Error("createEmbedding: einbetteViele ist keine Funktion.");
  }
  if (!Number.isInteger(adapter.dimensionen) || adapter.dimensionen <= 0) {
    throw new Error(
      `createEmbedding: dimensionen muss eine positive ganze Zahl sein (ist: ${adapter.dimensionen}).`,
    );
  }

  const port = {
    name: adapter.name,
    dimensionen: adapter.dimensionen,

    // Durchgereicht, nicht vorgeschrieben. Liegt ein Zwischenspeicher vor dem
    // Adapter (ADR-0016), hängt hier seine Buchführung — sonst `undefined`.
    // Sie steht NICHT in PFLICHTFELDER: ein Adapter ohne Zwischenspeicher ist
    // ein gültiger Adapter, und der Port darf nichts verlangen, was mit
    // seiner Aufgabe — Text zu Vektor — nichts zu tun hat.
    zwischenspeicher: adapter.zwischenspeicher,

    async einbetteViele(texte, art) {
      if (!ARTEN.includes(art)) {
        throw new Error(
          `einbetteViele: unbekannte Art "${art}" (erlaubt: ${ARTEN.join(", ")}).`,
        );
      }
      if (texte.length === 0) return [];

      const vektoren = await adapter.einbetteViele(texte, art);

      // ── Die wichtigste Prüfung dieses Ports. ─────────────────────────
      // Liefert ein Adapter WENIGER Vektoren als Texte, verschiebt sich die
      // Zuordnung Chunk ↔ Vektor um eins — und ab da trägt jeder Chunk den
      // Vektor eines anderen. Das ist eine Datenverfälschung, die sich als
      // „schlechte Suchqualität" tarnt und die keine Metrik dieses Repos
      // fangen würde: 3.13 zählt unerlaubte Treffer, nicht falsch
      // zugeordnete. Deshalb laut, hier, sofort.
      if (!Array.isArray(vektoren) || vektoren.length !== texte.length) {
        throw new Error(
          `Embedding "${adapter.name}": ${texte.length} Texte hineingegeben, ${vektoren?.length} Vektoren zurück.`,
        );
      }
      for (const [i, v] of vektoren.entries()) {
        if (!Array.isArray(v) || v.length !== port.dimensionen) {
          throw new Error(
            `Embedding "${adapter.name}": Vektor ${i} hat ${v?.length} statt ${port.dimensionen} Dimensionen.`,
          );
        }
      }
      return vektoren;
    },

    // Der Einzelfall, über den Stapel gebaut — nicht umgekehrt.
    async einbette(text, art) {
      return (await port.einbetteViele([text], art))[0];
    },
  };

  return port;
}
