// ── kernel/agent/runner.js ───────────────────────────────────────────────
// Die Schicht, die den Graphen ausführt. Drei Verantwortungen:
//   1) Streamen und bei jedem Knotenübergang ein SSE-Event senden.
//   2) Je Lauf einen Trace schreiben — der Bus zeigt an und vergisst,
//      der Trace misst und bleibt.
//   3) Die HITL-Brücke: hält der Graph bei human_approval, wird abgebrochen;
//      kommt die Genehmigung, geht es mit derselben thread_id vom Checkpoint WEITER.
//
// Gründerlektion (HITL): Das ist eine Zustandsmaschine, die ZWISCHEN ZWEI
// HTTP-Anfragen lebt. Die erste startet den Workflow und hält bei "__interrupt__".
// Die zweite (die Genehmigung) aktualisiert denselben Checkpoint und setzt fort.
// Das Geheimnis ist: DIESELBE thread_id.

import { buildGraph, HUMAN_NODE } from "./build.js";
import { emitToThread, scheduleBufferGc } from "../governance/eventBus.js";
import { startTrace, resumeTrace } from "../governance/trace.js";
import { env } from "../config/env.js";

// ── Die Frist der Genehmigung (Etappe 4c) ──────────────────────────────
// Ein „ja" nach Ablauf der Frist wird zu einem „nein": Voreinstellung deny.
// Eine Genehmigung bestätigt einen Entwurf und eine Lage von damals; zu spät
// gegeben, bestätigt sie etwas, das niemand mehr angesehen hat.
//
// Nur die GENEHMIGUNG läuft ab. Eine späte Ablehnung bleibt eine Ablehnung:
// sie ändert nichts in der Welt, und sie als „abgelaufen" zu buchen, machte
// eine bewusste Entscheidung zu einem Versäumnis.
//
// Fehlt `wartetSeit`, gilt die Frist als abgelaufen (fail-closed). Ein Lauf,
// dessen Wartebeginn niemand kennt, könnte sonst beliebig spät genehmigt
// werden — und ein fehlendes Feld sähe aus wie ein frisches.
//
// Abgelaufen heißt: der Lauf wird mit `humanApproval: false` zu Ende geführt
// — dieselbe Kante in `build.js` wie bei der Ablehnung, nichts eingereiht,
// nichts zugestellt —, aber unter eigenem Status `EXPIRED`. Als REJECTED
// gebucht, wäre eine Frist, die zuschlägt, von einem Menschen, der ablehnt,
// nicht zu unterscheiden.
//
// Eigene Funktion aus demselben Grund wie `pruefeBearbeitung`.
async function pruefeFrist({
  genehmigt,
  genehmigender,
  app,
  threadId,
  config,
  jetzt,
  genehmigungsFristMs,
  uebergang,
}) {
  if (genehmigt !== true) return { ok: true };

  const snap = await app.getState(config);
  const wartetSeit = snap.values?.wartetSeit;
  const bekannt = Number.isFinite(wartetSeit);
  const wartetMs = bekannt ? jetzt() - wartetSeit : null;
  if (bekannt && wartetMs <= genehmigungsFristMs) return { ok: true };

  // Im Audit steht, was WIRKSAM wurde — ein Nein —, mit dem, der zu spät Ja
  // sagte. Die eigene Zeile darunter sagt, warum.
  const trace = resumeTrace({
    runId: threadId,
    entscheidung: { genehmigt: false, genehmigender },
  });
  trace.line?.({
    type: "entscheidung_abgelaufen",
    wartet_ms: wartetMs,
    frist_ms: genehmigungsFristMs,
  });

  await app.updateState(config, { humanApproval: false });
  for await (const step of await app.stream(null, config)) {
    uebergang(trace, threadId, step);
  }

  trace.end("EXPIRED");
  emitToThread(threadId, { type: "workflow_complete", status: "EXPIRED" });

  return {
    ok: false,
    antwort: {
      angewandt: false,
      grund: bekannt
        ? `Genehmigung abgelaufen: ${wartetMs} ms gewartet, die Frist ist ` +
          `${genehmigungsFristMs} ms — abgelehnt (Voreinstellung deny).`
        : "Genehmigung abgelaufen: der Wartebeginn ist unbekannt — abgelehnt " +
          "(fail-closed, Voreinstellung deny).",
    },
  };
}

// ── Der bearbeitete Entwurf (A12, ADR-0022) ────────────────────────────
// Er hat den Prüfer NIE gesehen. Deshalb läuft er erneut durch den
// Ausgabevertrag der Domäne — und danach ohnehin durch die Validierer der
// Queue, die jede Aktion vor der Ausführung prüfen.
//
// Der Kern kennt keinen Vertrag; die Domäne liefert ihn als `pruefeEntwurf`.
// Fehlt er, wird ein bearbeiteter Entwurf ABGELEHNT statt durchgereicht:
// eine Domäne, die ihre eigene Ausgabe nicht prüfen kann, darf keine fremde
// Fassung übernehmen. Fail-closed, wie überall an dieser Kante.
//
// Eigene Funktion, damit `resolveApproval` die REIHENFOLGE der Tore zeigt
// und nicht die Mechanik eines einzelnen.
async function pruefeBearbeitung({
  domain,
  app,
  threadId,
  config,
  bearbeiteterEntwurf,
  genehmigender,
}) {
  if (bearbeiteterEntwurf === null) {
    return { ok: true, patch: {}, unterschied: null };
  }

  if (typeof domain.pruefeEntwurf !== "function") {
    throw new Error(
      `Entscheidung: die Domäne "${domain.name}" nimmt keinen bearbeiteten ` +
        "Entwurf entgegen — sie liefert kein `pruefeEntwurf`.",
    );
  }

  const snap = await app.getState(config);
  const urteil = domain.pruefeEntwurf({
    bearbeiteterEntwurf,
    zustand: snap.values,
  });

  if (urteil?.ok) {
    return {
      ok: true,
      patch: urteil.patch ?? {},
      // Vom Unterschied zwischen Entwurf und genehmigter Fassung landet NUR
      // EINE ZAHL im Trace (A12, ARCHITECTURE.md §5).
      unterschied:
        typeof urteil.unterschied === "number" ? urteil.unterschied : null,
    };
  }

  // VERWORFEN. Der Lauf wird NICHT fortgesetzt und bleibt stehen, wo er
  // stand: eine schlechte Bearbeitung soll den Vorgang nicht töten, sondern
  // zurückgewiesen werden. Nichts wird eingereiht, nichts zugestellt.
  const trace = resumeTrace({
    runId: threadId,
    entscheidung: { genehmigt: null, genehmigender },
  });
  // Nur die LÄNGE der Begründung: sie zitiert den Entwurf und wäre damit
  // Volltext im Trace.
  trace.line({
    type: "entscheidung_verworfen",
    grund_length: String(urteil?.gruende ?? "").length,
  });
  emitToThread(threadId, {
    type: "workflow_complete",
    status: "AWAITING_APPROVAL",
  });

  return {
    ok: false,
    antwort: {
      angewandt: false,
      grund: urteil?.gruende ?? "Der bearbeitete Entwurf verletzt den Vertrag.",
    },
  };
}

// `jetzt` ist einspeisbar, damit der Ablauf der Frist PRÜFBAR ist, ohne zu
// warten — dieselbe Linie wie beim Auflöser der Identität: ein Test, der
// schläft, misst die Uhr und nicht die Regel.
export function createRunner(
  domain,
  {
    jetzt = () => Date.now(),
    genehmigungsFristMs = env.genehmigungsFristMs,
  } = {},
) {
  if (!Number.isFinite(genehmigungsFristMs) || genehmigungsFristMs <= 0) {
    throw new Error(
      "createRunner: `genehmigungsFristMs` muss positiv und endlich sein. " +
        "Null ließe jede Genehmigung ablaufen, unendlich keine.",
    );
  }
  const app = buildGraph(domain);

  // Ein Knotenübergang: erst messen, dann anzeigen.
  const uebergang = (trace, threadId, step) => {
    for (const [node, update] of Object.entries(step)) {
      trace.node(node, update);
      (update.log || []).forEach((line) =>
        emitToThread(threadId, { type: "agent_log", node, line }),
      );
      emitToThread(threadId, { type: "agent_active", node });
    }
  };

  // Startet einen Workflow. Läuft bis human_approval und hält dort an.
  //
  // `principal` ist die Identität, in deren Namen der Lauf liest (ADR-0019,
  // T1). Fehlt er, bleibt das Feld auf `null` — der Leseweg antwortet dann
  // leer und mit Grund, statt ungefiltert. Eine Domäne ohne Leseweg merkt
  // von diesem Feld nichts.
  async function startWorkflow({ task, threadId, principal = null }) {
    const config = { configurable: { thread_id: threadId } };
    const trace = startTrace({ runId: threadId, task });
    let interrupted = false;

    // stream: nach jedem fertigen Knoten kommt ein "update".
    for await (const step of await app.stream(
      { task, threadId, principal },
      config,
    )) {
      uebergang(trace, threadId, step);
    }

    // Hat er angehalten? Den State prüfen.
    const snap = await app.getState(config);
    if (snap.next && snap.next.includes(HUMAN_NODE)) {
      interrupted = true;
      // Der Wartebeginn gehört in den Checkpoint, nicht in den Speicher
      // dieses Prozesses: die Genehmigung kommt mit einer zweiten Anfrage,
      // und die Frist muss einen Neustart dazwischen überleben.
      await app.updateState(config, { wartetSeit: jetzt() });
      trace.pause("AWAITING_APPROVAL");
      emitToThread(threadId, {
        type: "workflow_complete",
        status: "AWAITING_APPROVAL",
      });
    } else {
      trace.end("DONE");
      emitToThread(threadId, { type: "workflow_complete", status: "DONE" });
    }
    scheduleBufferGc(threadId);
    return { interrupted };
  }

  // Wendet die HITL-Entscheidung an und setzt fort.
  //
  // SEIT ADR-0022 IST DIE GENEHMIGUNG EIN ENTSCHEIDUNGSOBJEKT, KEIN BOOLEAN
  // (A12). Sie trägt, WER entschieden hat, und optional einen vom Menschen
  // BEARBEITETEN Entwurf. Der Grund ist nicht Buchhaltung: ein Boolean kann
  // niemand einer Person zuordnen, und eine Genehmigung, die niemandem
  // gehört, ist als Nachweis wertlos.
  //
  // Die Kante in `build.js` bleibt unberührt: sie prüft weiter auf exakt
  // `true`. Was sich ändert, ist nur, was VOR ihr ankommt.
  async function resolveApproval({ threadId, entscheidung }) {
    const {
      genehmigt,
      genehmigender = null,
      bearbeiteterEntwurf = null,
    } = entscheidung ?? {};

    // Nur ein echtes Boolean. Dieselbe Regel wie am HTTP-Rand, und aus
    // demselben Grund: `Boolean("false")` ist `true`. Hier wirft sie, statt
    // 400 zu antworten — der Kern hat keinen Statuscode.
    if (typeof genehmigt !== "boolean") {
      throw new Error(
        "Entscheidung: `genehmigt` muss ein Boolean sein (true oder false).",
      );
    }

    // Ein Genehmigender ohne aufgelöste Identität ist keiner (4a, ADR-0018).
    // Die Forderung gilt für die GENEHMIGUNG, nicht für die Ablehnung: eine
    // Ablehnung ändert nichts in der Welt, eine Genehmigung schon. Wer auch
    // die Ablehnung zuordnen will, gibt den Genehmigenden trotzdem mit — er
    // landet dann ebenso im Audit.
    if (genehmigt === true && !genehmigender?.benutzerId) {
      throw new Error(
        "Entscheidung: eine Genehmigung ohne aufgelösten Genehmigenden ist keine " +
          "(erwartet wird ein Principal mit benutzerId).",
      );
    }

    const config = { configurable: { thread_id: threadId } };

    // Die Frist steht VOR der Bearbeitung: ein abgelaufenes „ja" soll nicht
    // erst einen Vertrag prüfen lassen, dessen Ergebnis ohnehin nicht zählt.
    const frist = await pruefeFrist({
      genehmigt,
      genehmigender,
      app,
      threadId,
      config,
      jetzt,
      genehmigungsFristMs,
      uebergang,
    });
    if (!frist.ok) return frist.antwort;

    const bearbeitung = await pruefeBearbeitung({
      domain,
      app,
      threadId,
      config,
      bearbeiteterEntwurf,
      genehmigender,
    });
    if (!bearbeitung.ok) return bearbeitung.antwort;
    const { patch, unterschied } = bearbeitung;

    // Dieselbe run_id, dieselbe Trace-Datei: die menschliche Entscheidung ist
    // eine eigene Zeile und damit nachträglich prüfbar — seit ADR-0022 mit
    // ihrem Genehmigenden und in einer Hash-Kette.
    const trace = resumeTrace({
      runId: threadId,
      entscheidung: { genehmigt, genehmigender, unterschied },
    });

    // Die menschliche Entscheidung in den Checkpoint schreiben.
    await app.updateState(config, { humanApproval: genehmigt, ...patch });

    // ABLEHNUNG ist endgültig: die bedingte Kante in build.js führt nach END,
    // also wird nichts eingereiht und nichts veröffentlicht.
    //
    // Eine Ablehnung in eine neue Revisionsrunde zu führen wäre ein eigenes
    // Merkmal. Halt es draußen, bis das Genehmigungstor gemessen ist.

    // Ein stream mit null = vom Checkpoint FORTSETZEN.
    for await (const step of await app.stream(null, config)) {
      uebergang(trace, threadId, step);
    }

    trace.end(genehmigt ? "PUBLISHED" : "REJECTED");
    emitToThread(threadId, {
      type: "workflow_complete",
      status: genehmigt ? "PUBLISHED" : "REJECTED",
    });
    return { angewandt: true, grund: null };
  }

  return { app, startWorkflow, resolveApproval };
}
