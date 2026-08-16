"use client";

import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { formatDay, PHASE_LABEL } from "@/lib/tennis";
import { computeGroupStandings, type StandRow } from "@/lib/standings";
import { hasGroupsPhase, hasKnockoutPhase, formatShort } from "@/lib/rules";
import type { CompetitorType, Format, Phase } from "@/lib/types";

export interface PdfCategory {
  id: string;
  name: string;
  shortName: string;
  type: CompetitorType;
  format: Format;
  qualifiersPerGroup: number;
}

export interface PdfCompetitor {
  id: string;
  categoryId: string;
  groupId: string | null;
  name: string;
}

export interface PdfMatch {
  id: string;
  categoryId: string;
  phase: Phase;
  groupId: string | null;
  day: string;
  time: string;
  status: string;
  courtName: string | null;
  aId: string | null;
  bId: string | null;
  /** Nome real quando já se sabe quem joga; senão a previsão ("2º do Grupo B"). */
  nameA: string;
  nameB: string;
  sets: { a: number; b: number; tbA?: number; tbB?: number }[];
  winnerId: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ece9f9",
  },
  logo: { width: 118, height: 49, objectFit: "contain", marginRight: 14 },
  headerText: { flexGrow: 1 },
  tournamentName: { fontSize: 10, color: "#6b6b8f", marginBottom: 2 },
  categoryTitle: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  categoryMeta: { fontSize: 10, color: "#555577" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#3b2a8c",
  },
  groupBlock: { marginBottom: 10 },
  groupLabel: {
    fontSize: 10,
    fontWeight: 700,
    backgroundColor: "#ece9f9",
    color: "#3b2a8c",
    padding: 4,
  },
  table: { display: "flex", flexDirection: "column" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999" },
  th: { fontSize: 8, fontWeight: 700, color: "#666", padding: 4 },
  td: { fontSize: 9, padding: 4 },
  colRank: { width: 16, textAlign: "right" },
  colName: { flex: 3 },
  colNum: { flex: 1, textAlign: "center" },
  colDay: { flex: 2 },
  colTime: { flex: 1 },
  colPhase: { flex: 2 },
  colMatch: { flex: 4 },
  colCourt: { flex: 2 },
  colStatus: { flex: 2 },
  dayHeader: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 2, color: "#3b2a8c" },
  empty: { fontSize: 9, color: "#888", marginTop: 4, marginBottom: 8 },
  note: { fontSize: 8, color: "#666", marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  finalizado: "Encerrado",
  wo: "W.O.",
};

/** Saldo com sinal: +3, -2, 0. */
function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

/** Placar no padrão do tênis: 7-6(6) — entre parênteses os pontos de quem
 *  perdeu o tie-break. */
function scoreText(sets: { a: number; b: number; tbA?: number; tbB?: number }[]) {
  return sets
    .map((s) => {
      const tb =
        s.tbA !== undefined && s.tbB !== undefined
          ? `(${Math.min(s.tbA, s.tbB)})`
          : "";
      return `${s.a}-${s.b}${tb}`;
    })
    .join(" ");
}

type StandRowWithName = StandRow & { name: string };

/** Cabeçalho com a logo do clube. Sem a logo, cai só no texto. */
function PageHeader({
  logo,
  tournamentLabel,
  title,
  meta,
}: {
  logo?: string;
  tournamentLabel: string;
  title: string;
  meta?: string;
}) {
  return (
    <View style={styles.header}>
      {logo ? <Image src={logo} style={styles.logo} /> : null}
      <View style={styles.headerText}>
        <Text style={styles.tournamentName}>{tournamentLabel}</Text>
        <Text style={styles.categoryTitle}>{title}</Text>
        {meta ? <Text style={styles.categoryMeta}>{meta}</Text> : null}
      </View>
    </View>
  );
}

function CategoryPage({
  tournamentLabel,
  category,
  standings,
  matches,
  logo,
}: {
  tournamentLabel: string;
  category: PdfCategory;
  standings: { groupId: string; rows: StandRowWithName[] }[];
  matches: PdfMatch[];
  nameById: Map<string, string>;
  logo?: string;
}) {
  const showGroups = hasGroupsPhase(category.format);
  const showKnockout = hasKnockoutPhase(category.format);
  const sorted = [...matches].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  const byDay = new Map<string, PdfMatch[]>();
  for (const m of sorted) {
    if (!byDay.has(m.day)) byDay.set(m.day, []);
    byDay.get(m.day)!.push(m);
  }

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader
        logo={logo}
        tournamentLabel={tournamentLabel}
        title={category.name}
        meta={`${category.type === "duplas" ? "Duplas" : "Simples"} · ${formatShort(category.format)}`}
      />

      {showGroups && (
        <View>
          <Text style={styles.sectionTitle}>Classificação dos grupos</Text>
          {standings.length === 0 && (
            <Text style={styles.empty}>Grupos ainda não gerados.</Text>
          )}
          {standings.map((g) => (
            <View key={g.groupId} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>Grupo {g.groupId}</Text>
              <View style={styles.table}>
                <View style={styles.thRow}>
                  <Text style={[styles.th, styles.colRank]} />
                  <Text style={[styles.th, styles.colName]}>{category.type === "duplas" ? "Dupla" : "Atleta"}</Text>
                  <Text style={[styles.th, styles.colNum]}>J</Text>
                  <Text style={[styles.th, styles.colNum]}>V</Text>
                  <Text style={[styles.th, styles.colNum]}>S. Sets</Text>
                  <Text style={[styles.th, styles.colNum]}>S. Games</Text>
                </View>
                {g.rows.map((r, i) => (
                  <View key={r.competitorId} style={styles.tr}>
                    <Text style={[styles.td, styles.colRank]}>{i + 1}</Text>
                    <Text style={[styles.td, styles.colName]}>{r.name}</Text>
                    <Text style={[styles.td, styles.colNum]}>{r.played}</Text>
                    <Text style={[styles.td, styles.colNum]}>{r.wins}</Text>
                    <Text style={[styles.td, styles.colNum]}>
                      {r.played ? signed(r.setDiff) : "—"}
                    </Text>
                    <Text style={[styles.td, styles.colNum]}>
                      {r.played ? signed(r.gameDiff) : "—"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          {standings.length > 0 &&
            (showKnockout ? (
              <Text style={styles.note}>
                {category.qualifiersPerGroup === 1
                  ? "O 1º de cada grupo avança"
                  : `Os ${category.qualifiersPerGroup} primeiros de cada grupo avançam`}{" "}
                ao mata-mata.
              </Text>
            ) : (
              <View style={styles.note}>
                <Text>
                  {standings.length > 1 ? "Em cada grupo, o" : "O"} 1º colocado é o
                  campeão e o 2º, o vice-campeão.
                </Text>
                <Text>
                  Desempate entre duas duplas: confronto direto. Entre três ou mais:
                  saldo de sets, saldo de games, games pró e games contra, nessa ordem.
                </Text>
              </View>
            ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Agenda de jogos</Text>
      {sorted.length === 0 && <Text style={styles.empty}>Nenhum jogo agendado ainda.</Text>}
      {[...byDay.entries()].map(([day, list]) => (
        <View key={day}>
          <Text style={styles.dayHeader}>{formatDay(day)}</Text>
          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={[styles.th, styles.colTime]}>Hora</Text>
              <Text style={[styles.th, styles.colPhase]}>Fase</Text>
              <Text style={[styles.th, styles.colMatch]}>Confronto</Text>
              <Text style={[styles.th, styles.colCourt]}>Quadra</Text>
              <Text style={[styles.th, styles.colStatus]}>Status</Text>
            </View>
            {list.map((m) => (
              <View key={m.id} style={styles.tr}>
                <Text style={[styles.td, styles.colTime]}>{m.time}</Text>
                <Text style={[styles.td, styles.colPhase]}>
                  {PHASE_LABEL[m.phase]}
                  {m.groupId ? ` ${m.groupId}` : ""}
                </Text>
                <Text style={[styles.td, styles.colMatch]}>
                  {m.nameA} × {m.nameB}
                </Text>
                <Text style={[styles.td, styles.colCourt]}>{m.courtName ?? "—"}</Text>
                <Text style={[styles.td, styles.colStatus]}>
                  {STATUS_LABEL[m.status] ?? m.status}
                  {(m.status === "finalizado" || m.status === "wo" || m.status === "desistencia") && m.sets.length
                    ? ` (${scoreText(m.sets)})`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer}>
        {tournamentLabel} — {category.name}
      </Text>
    </Page>
  );
}

function CronogramaGeral({
  matches,
  nameById,
  tournamentLabel,
  logo,
}: {
  matches: PdfMatch[];
  nameById: Map<string, string>;
  tournamentLabel: string;
  logo?: string;
}) {
  const sorted = [...matches].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  const byDay = new Map<string, PdfMatch[]>();
  for (const m of sorted) {
    if (!byDay.has(m.day)) byDay.set(m.day, []);
    byDay.get(m.day)!.push(m);
  }

  const days = Array.from(byDay.keys()).sort();

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader
        logo={logo}
        tournamentLabel={tournamentLabel}
        title="Cronograma geral"
        meta="Todos os jogos, dia a dia"
      />

      {days.map((day) => {
        const dayMatches = byDay.get(day) ?? [];
        return (
          <View key={day} style={{ marginBottom: 12 }}>
            <Text style={styles.dayHeader}>{formatDay(day)}</Text>
            <View style={styles.table}>
              <View style={styles.thRow}>
                <Text style={[styles.th, { flex: 0.8 }]}>Hora</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>Categoria</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>Fase</Text>
                <Text style={[styles.th, { flex: 3 }]}>Confronto</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>Quadra</Text>
              </View>
              {dayMatches.map((m) => (
                <View key={m.id} style={styles.tr}>
                  <Text style={[styles.td, { flex: 0.8 }]}>{m.time}</Text>
                  <Text style={[styles.td, { flex: 1.5, fontSize: 8 }]}>
                    {m.categoryId ? nameById.get(m.categoryId) || "?" : "?"}
                  </Text>
                  <Text style={[styles.td, { flex: 0.8, fontSize: 8 }]}>
                    {PHASE_LABEL[m.phase]}
                    {m.groupId ? ` ${m.groupId}` : ""}
                  </Text>
                  <Text style={[styles.td, { flex: 3, fontSize: 8 }]}>
                    {m.nameA} × {m.nameB}
                  </Text>
                  <Text style={[styles.td, { flex: 1.2, fontSize: 8 }]}>
                    {m.courtName ?? "—"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <Text style={styles.footer}>Cronograma do Torneio</Text>
    </Page>
  );
}

export function TournamentDocument({
  tournamentLabel,
  categories,
  competitors,
  matches,
  logo,
}: {
  tournamentLabel: string;
  categories: PdfCategory[];
  competitors: PdfCompetitor[];
  matches: PdfMatch[];
  logo?: string;
}) {
  const nameById = new Map(competitors.map((c) => [c.id, c.name]));
  const catNamesById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <Document>
      {categories.map((cat) => {
        const catCompetitors = competitors.filter((c) => c.categoryId === cat.id);
        const catMatches = matches.filter((m) => m.categoryId === cat.id);
        const standings = computeGroupStandings(
          catCompetitors.map((c) => ({ id: c.id, groupId: c.groupId })),
          catMatches
            .filter((m) => m.phase === "grupo")
            .map((m) => ({
              groupId: m.groupId,
              aId: m.aId,
              bId: m.bId,
              sets: m.sets,
              winnerId: m.winnerId,
              finished: m.status === "finalizado" || m.status === "wo" || m.status === "desistencia",
            }))
        ).map((g) => ({
          groupId: g.groupId,
          rows: g.rows.map((r) => ({ ...r, name: nameById.get(r.competitorId) ?? "?" })),
        }));

        return (
          <CategoryPage
            key={cat.id}
            tournamentLabel={tournamentLabel}
            category={cat}
            standings={standings}
            matches={catMatches}
            nameById={nameById}
            logo={logo}
          />
        );
      })}

      {/* Cronograma geral do torneio */}
      <CronogramaGeral
        matches={matches.map((m) => ({
          ...m,
          categoryId: m.categoryId,
        }))}
        nameById={catNamesById}
        tournamentLabel={tournamentLabel}
        logo={logo}
      />
    </Document>
  );
}

/**
 * Lê a logo e devolve como data URI. Embutir os bytes evita depender de o
 * gerador de PDF conseguir buscar a URL sozinho no meio da renderização.
 * Falhando, o PDF sai sem a logo em vez de não sair.
 */
async function loadLogo(): Promise<string | undefined> {
  try {
    const res = await fetch("/logo-100anos.png");
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** Gera o PDF e dispara o download no navegador. */
export async function downloadTournamentPdf(props: {
  tournamentLabel: string;
  categories: PdfCategory[];
  competitors: PdfCompetitor[];
  matches: PdfMatch[];
  fileName?: string;
}) {
  const logo = await loadLogo();
  const blob = await pdf(
    <TournamentDocument
      tournamentLabel={props.tournamentLabel}
      categories={props.categories}
      competitors={props.competitors}
      matches={props.matches}
      logo={logo}
    />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = props.fileName ?? "torneio.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
