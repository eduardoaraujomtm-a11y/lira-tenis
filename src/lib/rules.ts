import type { ScoreRule, Format, CompetitorType } from "./types";

export interface RulePreset {
  id: string;
  label: string;
  rule: ScoreRule;
}

export const RULE_PRESETS: RulePreset[] = [
  {
    id: "best3",
    label: "Melhor de 3 sets (6 games) + super tie-break",
    rule: { bestOfSets: 3, gamesPerSet: 6, tiebreakTo: 7, superTiebreak: true, superTiebreakTo: 10, noAd: false },
  },
  {
    id: "curto",
    label: "Set curto (4 games) + no-ad + super tie-break",
    rule: { bestOfSets: 3, gamesPerSet: 4, tiebreakTo: 7, superTiebreak: true, superTiebreakTo: 10, noAd: true },
  },
  {
    id: "umset6",
    label: "1 set (6 games) com tie-break",
    rule: { bestOfSets: 1, gamesPerSet: 6, tiebreakTo: 7, superTiebreak: false, superTiebreakTo: 10, noAd: false },
  },
  {
    id: "proset8",
    label: "Pro set (8 games) com tie-break",
    rule: { bestOfSets: 1, gamesPerSet: 8, tiebreakTo: 7, superTiebreak: false, superTiebreakTo: 10, noAd: false },
  },
];

/** Encontra o id do preset que corresponde a uma regra (ou "best3" por padrão). */
export function presetIdFor(rule?: ScoreRule): string {
  if (!rule) return "best3";
  const found = RULE_PRESETS.find(
    (p) =>
      p.rule.bestOfSets === rule.bestOfSets &&
      p.rule.gamesPerSet === rule.gamesPerSet &&
      p.rule.superTiebreak === rule.superTiebreak &&
      p.rule.noAd === rule.noAd
  );
  return found?.id ?? "best3";
}

export const FORMAT_OPTIONS: { value: Format; label: string; short: string }[] = [
  { value: "grupos", label: "Somente grupos (todos contra todos)", short: "Só grupos" },
  { value: "mata_mata", label: "Somente mata-mata (eliminatória)", short: "Só mata-mata" },
  { value: "grupos_mata_mata", label: "Grupos + mata-mata", short: "Grupos + mata-mata" },
];

export const TYPE_OPTIONS: { value: CompetitorType; label: string }[] = [
  { value: "duplas", label: "Duplas" },
  { value: "simples", label: "Simples" },
];

export function formatShort(f: Format): string {
  return FORMAT_OPTIONS.find((o) => o.value === f)?.short ?? f;
}

/** Capacidades derivadas do formato. */
export const hasGroupsPhase = (f: Format) => f === "grupos" || f === "grupos_mata_mata";
export const hasKnockoutPhase = (f: Format) => f === "mata_mata" || f === "grupos_mata_mata";
