// Script de importação: I Lira Tennis Open 2026 (Simples)
// Uso: node scripts/import-simples.mjs
//
// Requer SUPABASE_SERVICE_ROLE_KEY no .env.local (ou como variável de ambiente).
// A anon key não tem permissão de INSERT direto — precisa da service_role.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Carrega .env.local
const envPath = resolve(import.meta.dirname, "../.env.local");
const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim().replace(/^"|"$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY não encontrada.\n" +
    "   Adicione no .env.local ou passe como variável de ambiente:\n" +
    "   SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-simples.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============ Mapeamento de atletas existentes (nome normalizado → id) ============

const { data: existingAthletes } = await supabase.from("athletes").select("id,name");
const normalize = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const athleteByName = new Map(existingAthletes.map((a) => [normalize(a.name), a.id]));

function findAthlete(name) {
  return athleteByName.get(normalize(name)) ?? null;
}

// ============ Criar atletas novos ============

const newAthletes = [
  "Alessandro Gabriel",
  "Andrus Silva",
  // "Marcelo Flores" = Marcelo Rothbarth (já existe)
  "Filipe Gonçalves",
  "Edison Scheer",
  "Ivo Borchardt",
  "Eduarda Viana",
  "Sérgio Muller",
  "Darlan Matte",
  "Luciano Pauli",
  "Raphael Cunha",
  "Roberta Ghizzo",
  "João Bitencourt",
  "Cláudio Camerano",
  "Diego Telomaro",
  "Lucas Linhares",
  "Bruno Benato",
  "Thiago Araújo",
  "João Sell",
  "Pedro Alexandre",
  "Rafael Barbosa",
  "Túlio de Bem",
  "Gustavo Sperry",
  "Roberto Abrahão",
  "Bernardo Resch",
  "Eduardo Reblin",
  "Eduardo Reitz",
  "Edson Margarida",
  "Marina D'Ivanenko",
  "Olívia D'Ivanenko",
  "Aline Laste",
  "Manuela Sell",
];

for (const name of newAthletes) {
  if (findAthlete(name)) {
    console.log(`  ✓ ${name} já existe`);
    continue;
  }
  const { data, error } = await supabase
    .from("athletes")
    .insert({ name })
    .select("id")
    .single();
  if (error) {
    console.error(`  ✗ Erro ao criar ${name}:`, error.message);
    continue;
  }
  athleteByName.set(normalize(name), data.id);
  console.log(`  + ${name} criado (${data.id})`);
}

// Aliases para nomes que diferem entre PDF e banco
const ALIASES = {
  "Marcelo Flores": "Marcelo Rothbarth",
  "Cláudia Scharf": "Claudia Schaefer",
  "Carolina Vecchio": "Carolina Vechio",
  "Diogo Pitisica": "Diogo Pitsica",
  "Adilson José": "Adilson",
  "Júnior Cavichioli": "Junior Cavichioli",
  "Vinicius Nery": "Vinícius Nery",
  "Bárbara Correa": "Bárbara Corrêa",
  "Renata Stoterau": "Renata Stoeterau",
  "Flavia Bitencourt": "Flávia Bitencourt",
  "Flávia Bitencourt": "Flávia Bitencourt",
  "Luciano L.": "Luciano Lehmkuhl",
  "Cícero de Bem": "Cicero de Bem",
  "Thiago D'Ivanenko": "Thiago Divanenko",
  "Carlos Eduardo": "Cadu Cardoso",
  "Ademar": "Ademar Vargas",
  "Antenor": "Antenor Filho",
  "Maurício Viana": "Mauricio Viana",
  "Maurício Araújo": "Mauricio Araujo",
  "Eduardo Araújo": "Eduardo Araújo",
  "Murilo Araújo": "Murilo Araujo",
  "Antônio Lemos": "Antônio Lemos",
};

function resolveAthlete(name) {
  const resolved = ALIASES[name] ?? name;
  const id = findAthlete(resolved);
  if (!id) {
    console.error(`  ⚠ Atleta não encontrado: "${name}" (resolvido: "${resolved}")`);
  }
  return id;
}

// ============ Criar ou buscar torneio "I Lira Tennis Open" ============

const { data: existingTournament } = await supabase
  .from("tournaments")
  .select("id")
  .eq("name", "I Lira Tennis Open")
  .maybeSingle();

let tournamentId;
if (existingTournament) {
  tournamentId = existingTournament.id;
  console.log(`\nTorneio existente: ${tournamentId}`);
} else {
  const { data: newT, error: tErr } = await supabase
    .from("tournaments")
    .insert({
      name: "I Lira Tennis Open",
      club: "Lira Tênis Clube",
      edition: "2026",
      days: ["2026-06-01"],
      slots: ["08:00"],
    })
    .select("id")
    .single();
  if (tErr) {
    console.error("✗ Erro ao criar torneio:", tErr.message);
    process.exit(1);
  }
  tournamentId = newT.id;
  console.log(`\nTorneio criado: ${tournamentId}`);
}

// ============ Definição das categorias e jogos ============

const CATEGORIES = [
  {
    name: "Simples - 1ª Classe",
    shortName: "S1",
    type: "simples",
    format: "mata_mata",
    players: [
      "Guilherme Born", "Maurício Viana", "André Machado", "Ari Leite",
      "Roberto Martins", "Paulo Ribeiro", "Alessandro Gabriel", "Nelson Germann",
      "Guilherme Levien", "Eduardo Araújo", "Andrus Silva", "Humberto Lyra",
      "Renato Flach", "Marcelo Flores", "Maurício Araújo", "Lucas Lobão",
      "Pedro Muller",
    ],
    matches: [
      // 1a Rodada
      { phase: "oitavas", a: "Maurício Viana", b: "André Machado", sets: [[6,2],[6,1]], winner: "a" },
      // Oitavas
      { phase: "oitavas", a: "Guilherme Born", b: "Maurício Viana", sets: [[2,6],[1,6]], winner: "b" },
      { phase: "oitavas", a: "Ari Leite", b: "Roberto Martins", sets: [[1,6],[2,6]], winner: "b" },
      { phase: "oitavas", a: "Paulo Ribeiro", b: "Alessandro Gabriel", sets: [[6,3],[6,0]], winner: "a" },
      { phase: "oitavas", a: "Nelson Germann", b: "Guilherme Levien", sets: [[1,6],[3,6]], winner: "b" },
      { phase: "oitavas", a: "Eduardo Araújo", b: "Andrus Silva", sets: [[6,1],[6,3]], winner: "a" },
      { phase: "oitavas", a: "Humberto Lyra", b: "Renato Flach", sets: [[7,6],[6,3]], winner: "a" },
      { phase: "oitavas", a: "Marcelo Flores", b: "Maurício Araújo", sets: [[7,5],[6,3]], winner: "a" },
      { phase: "oitavas", a: "Lucas Lobão", b: "Pedro Muller", sets: [[4,6],[4,5]], winner: "b", status: "wo" },
      // Quartas
      { phase: "quartas", a: "Maurício Viana", b: "Roberto Martins", sets: [[7,6],[6,3]], winner: "a" },
      { phase: "quartas", a: "Paulo Ribeiro", b: "Guilherme Levien", sets: [[6,1],[7,5]], winner: "a" },
      { phase: "quartas", a: "Humberto Lyra", b: "Eduardo Araújo", sets: [[6,3],[4,6],[11,9]], winner: "a" },
      { phase: "quartas", a: "Marcelo Flores", b: "Pedro Muller", sets: [[6,4],[6,3]], winner: "a" },
      // Semi
      { phase: "semi", a: "Maurício Viana", b: "Paulo Ribeiro", sets: [[6,4],[7,5]], winner: "a" },
      { phase: "semi", a: "Humberto Lyra", b: "Marcelo Flores", sets: [[2,6],[3,6]], winner: "b" },
      // Final
      { phase: "final", a: "Maurício Viana", b: "Marcelo Flores", sets: [[6,3],[6,2]], winner: "a" },
    ],
  },
  {
    name: "Simples - 2ª Classe",
    shortName: "S2",
    type: "simples",
    format: "mata_mata",
    players: [
      "Fernando Ribeiro", "Leandro Bonezi", "Thiago Andrade", "Rui Hinning",
      "Carlos Matos", "Filipe Gonçalves", "Milton Almeida", "Edison Scheer",
      "Ivo Borchardt", "Murilo Araújo", "Antenor", "Eduarda Viana",
      "Antônio Lemos", "Sérgio Muller", "Eduardo Lobo", "Luciano L.",
      "Darlan Matte",
    ],
    matches: [
      // 1a Rodada
      { phase: "oitavas", a: "Leandro Bonezi", b: "Thiago Andrade", sets: [[6,2],[1,6],[7,10]], winner: "b" },
      // Oitavas
      { phase: "oitavas", a: "Fernando Ribeiro", b: "Thiago Andrade", sets: [[4,6],[5,7]], winner: "b" },
      { phase: "oitavas", a: "Rui Hinning", b: "Carlos Matos", sets: [[7,6],[4,6],[7,10]], winner: "b" },
      { phase: "oitavas", a: "Filipe Gonçalves", b: "Milton Almeida", sets: [[2,6],[4,6]], winner: "b" },
      { phase: "oitavas", a: "Edison Scheer", b: "Ivo Borchardt", sets: [[7,5],[6,4]], winner: "a" },
      { phase: "oitavas", a: "Murilo Araújo", b: "Antenor", sets: [[2,6],[2,6]], winner: "b" },
      { phase: "oitavas", a: "Eduarda Viana", b: "Antônio Lemos", sets: [[5,7],[3,6]], winner: "b" },
      { phase: "oitavas", a: "Sérgio Muller", b: "Eduardo Lobo", sets: [[4,6],[6,1],[6,10]], winner: "b" },
      { phase: "oitavas", a: "Luciano L.", b: "Darlan Matte", sets: [[3,6],[0,6]], winner: "b" },
      // Quartas
      { phase: "quartas", a: "Thiago Andrade", b: "Carlos Matos", sets: [[7,6],[7,6]], winner: "a" },
      { phase: "quartas", a: "Milton Almeida", b: "Edison Scheer", sets: [[6,2],[2,6],[10,3]], winner: "a" },
      { phase: "quartas", a: "Antenor", b: "Antônio Lemos", sets: [[1,6],[6,4],[1,10]], winner: "b" },
      { phase: "quartas", a: "Eduardo Lobo", b: "Darlan Matte", sets: [[2,6],[2,6]], winner: "b" },
      // Semi
      { phase: "semi", a: "Thiago Andrade", b: "Milton Almeida", sets: [[6,4],[6,4]], winner: "a" },
      { phase: "semi", a: "Antônio Lemos", b: "Darlan Matte", sets: [[2,6],[1,6]], winner: "b" },
      // Final
      { phase: "final", a: "Thiago Andrade", b: "Darlan Matte", sets: [[6,3],[5,7],[9,11]], winner: "b" },
    ],
  },
  {
    name: "Simples - 3ª Classe",
    shortName: "S3",
    type: "simples",
    format: "mata_mata",
    players: [
      "Ademar", "Carlos Eduardo", "Luciano Pauli", "Raphael Cunha",
      "Roberta Ghizzo", "Darlan Cunha", "João Bitencourt", "Cláudio Camerano",
      "Eduardo Beil", "Diogo Pitisica",
    ],
    matches: [
      // Oitavas (com byes)
      { phase: "oitavas", a: "Carlos Eduardo", b: "Luciano Pauli", sets: [[3,6],[6,3],[10,3]], winner: "a" },
      { phase: "oitavas", a: "João Bitencourt", b: "Cláudio Camerano", sets: [[6,4],[6,0]], winner: "a" },
      { phase: "oitavas", a: "Eduardo Beil", b: "Diogo Pitisica", sets: [[1,6],[2,6]], winner: "b" },
      // Quartas
      { phase: "quartas", a: "Ademar", b: "Carlos Eduardo", sets: [[2,6],[4,6]], winner: "b" },
      { phase: "quartas", a: "Raphael Cunha", b: "Roberta Ghizzo", sets: [[6,3],[4,6],[10,4]], winner: "a" },
      { phase: "quartas", a: "Darlan Cunha", b: "João Bitencourt", sets: [[2,6],[2,6]], winner: "b" },
      { phase: "quartas", a: "Eduardo Beil", b: "Diogo Pitisica", sets: [[1,6],[2,6]], winner: "b" },
      // Semi
      { phase: "semi", a: "Carlos Eduardo", b: "Raphael Cunha", sets: [[7,6],[7,5]], winner: "a" },
      { phase: "semi", a: "João Bitencourt", b: "Diogo Pitisica", sets: [[3,6],[4,6]], winner: "b" },
      // Final
      { phase: "final", a: "Carlos Eduardo", b: "Diogo Pitisica", sets: [[2,6],[6,7]], winner: "b" },
    ],
  },
  {
    name: "Simples - 4ª Classe",
    shortName: "S4",
    type: "simples",
    format: "mata_mata",
    players: [
      "Diego Telomaro", "Cícero de Bem", "Lucas Linhares", "Bruno Benato",
      "Thiago Araújo", "João Sell", "Pedro Alexandre", "Thiago D'Ivanenko",
      "Rafael Barbosa", "Marcelo Chain", "Túlio de Bem", "Gustavo Sperry",
      "Roberto Abrahão",
    ],
    matches: [
      // Oitavas
      { phase: "oitavas", a: "Cícero de Bem", b: "Lucas Linhares", sets: [[4,6],[3,6]], winner: "b" },
      { phase: "oitavas", a: "Bruno Benato", b: "Thiago Araújo", sets: [[6,4],[6,1]], winner: "a" },
      { phase: "oitavas", a: "João Sell", b: "Pedro Alexandre", sets: [[0,0]], winner: "b", status: "wo" },
      { phase: "oitavas", a: "Rafael Barbosa", b: "Marcelo Chain", sets: [[3,6],[6,3],[10,7]], winner: "a" },
      { phase: "oitavas", a: "Túlio de Bem", b: "Gustavo Sperry", sets: [[0,0]], winner: "a", status: "wo" },
      // Quartas
      { phase: "quartas", a: "Diego Telomaro", b: "Lucas Linhares", sets: [[0,0]], winner: "a", status: "wo" },
      { phase: "quartas", a: "Bruno Benato", b: "Pedro Alexandre", sets: [[2,6],[1,6]], winner: "b" },
      { phase: "quartas", a: "Thiago D'Ivanenko", b: "Rafael Barbosa", sets: [[0,0]], winner: "a", status: "wo" },
      { phase: "quartas", a: "Túlio de Bem", b: "Roberto Abrahão", sets: [[0,6],[2,6]], winner: "b" },
      // Semi
      { phase: "semi", a: "Diego Telomaro", b: "Pedro Alexandre", sets: [[4,6],[4,6]], winner: "b" },
      { phase: "semi", a: "Thiago D'Ivanenko", b: "Roberto Abrahão", sets: [[6,4],[6,4]], winner: "a" },
      // Final
      { phase: "final", a: "Pedro Alexandre", b: "Thiago D'Ivanenko", sets: [[6,1],[6,4]], winner: "a" },
    ],
  },
  {
    name: "Simples - 5ª Classe",
    shortName: "S5",
    type: "simples",
    format: "mata_mata",
    players: [
      "Júnior Cavichioli", "Vinicius Nery", "Adilson José", "Bernardo Resch",
      "Rudson Marcos", "Eduardo Reblin", "Eduardo Reitz", "Edson Margarida",
    ],
    matches: [
      // Quartas
      { phase: "quartas", a: "Júnior Cavichioli", b: "Vinicius Nery", sets: [[6,1],[6,1]], winner: "a" },
      { phase: "quartas", a: "Adilson José", b: "Bernardo Resch", sets: [[6,0],[4,6],[10,8]], winner: "a" },
      { phase: "quartas", a: "Rudson Marcos", b: "Eduardo Reblin", sets: [[6,2],[6,2]], winner: "a" },
      { phase: "quartas", a: "Eduardo Reitz", b: "Edson Margarida", sets: [[6,0]], winner: "a", status: "wo" },
      // Semi
      { phase: "semi", a: "Júnior Cavichioli", b: "Adilson José", sets: [[6,1],[6,3]], winner: "a" },
      { phase: "semi", a: "Rudson Marcos", b: "Eduardo Reitz", sets: [[3,6],[3,6]], winner: "b" },
      // Final
      { phase: "final", a: "Júnior Cavichioli", b: "Eduardo Reitz", sets: [[2,6],[2,6]], winner: "b" },
    ],
  },
  {
    name: "Simples - Feminino",
    shortName: "SF",
    type: "simples",
    format: "mata_mata",
    players: [
      "Bruna Serpa", "Marina D'Ivanenko", "Bárbara Correa", "Olívia D'Ivanenko",
      "Carolina Vecchio", "Cláudia Scharf", "Juliana Chain", "Aline Laste",
      "Fernanda Dias", "Renata Stoterau", "Manuela Sell", "Flavia Bitencourt",
    ],
    matches: [
      // Oitavas
      { phase: "oitavas", a: "Marina D'Ivanenko", b: "Bárbara Correa", sets: [[6,3],[5,4]], winner: "a", status: "wo" },
      { phase: "oitavas", a: "Olívia D'Ivanenko", b: "Carolina Vecchio", sets: [[0,0]], winner: "b", status: "wo" },
      { phase: "oitavas", a: "Aline Laste", b: "Fernanda Dias", sets: [[2,6],[4,6]], winner: "b" },
      { phase: "oitavas", a: "Renata Stoterau", b: "Manuela Sell", sets: [[3,6],[6,1],[11,9]], winner: "a" },
      // Quartas
      { phase: "quartas", a: "Bruna Serpa", b: "Marina D'Ivanenko", sets: [[4,6],[0,6],[5,10]], winner: "b" },
      { phase: "quartas", a: "Carolina Vecchio", b: "Cláudia Scharf", sets: [[3,6],[7,5],[10,3]], winner: "a" },
      { phase: "quartas", a: "Juliana Chain", b: "Fernanda Dias", sets: [[4,6],[2,6]], winner: "b" },
      { phase: "quartas", a: "Renata Stoterau", b: "Flavia Bitencourt", sets: [[6,1],[6,0]], winner: "a" },
      // Semi
      { phase: "semi", a: "Marina D'Ivanenko", b: "Carolina Vecchio", sets: [[5,7],[6,1],[4,10]], winner: "b" },
      { phase: "semi", a: "Fernanda Dias", b: "Renata Stoterau", sets: [[2,6],[4,6]], winner: "b" },
      // Final
      { phase: "final", a: "Carolina Vecchio", b: "Renata Stoterau", sets: [[6,4],[6,3]], winner: "a" },
    ],
  },
];

// ============ Regra de placar padrão ============
const RULE = {
  bestOfSets: 3,
  gamesPerSet: 6,
  tiebreakTo: 7,
  superTiebreak: true,
  superTiebreakTo: 10,
  noAd: false,
};

// ============ Inserir categorias, competidores e jogos ============

// Buscar sort_order máximo atual
const { data: maxCat } = await supabase
  .from("categories")
  .select("sort_order")
  .order("sort_order", { ascending: false })
  .limit(1)
  .single();
let sortOrder = (maxCat?.sort_order ?? 0) + 1;

for (const cat of CATEGORIES) {
  console.log(`\n📁 ${cat.name}`);

  // Criar categoria
  const { data: catData, error: catErr } = await supabase
    .from("categories")
    .insert({
      tournament_id: tournamentId,
      name: cat.name,
      short_name: cat.shortName,
      type: cat.type,
      format: cat.format,
      rule: RULE,
      sort_order: sortOrder++,
      qualifiers_per_group: 2,
    })
    .select("id")
    .single();

  if (catErr) {
    console.error("  ✗ Erro ao criar categoria:", catErr.message);
    continue;
  }
  const categoryId = catData.id;
  console.log(`  ✓ Categoria criada: ${categoryId}`);

  // Criar competidores (simples = 1 atleta por competitor)
  const competitorMap = new Map(); // nome PDF → competitor_id

  for (const playerName of cat.players) {
    const athleteId = resolveAthlete(playerName);
    if (!athleteId) continue;

    const { data: compData, error: compErr } = await supabase
      .from("competitors")
      .insert({ category_id: categoryId })
      .select("id")
      .single();

    if (compErr) {
      console.error(`  ✗ Erro ao criar competitor para ${playerName}:`, compErr.message);
      continue;
    }

    await supabase.from("competitor_athletes").insert({
      competitor_id: compData.id,
      athlete_id: athleteId,
      position: 1,
    });

    competitorMap.set(playerName, compData.id);
  }
  console.log(`  ✓ ${competitorMap.size} competidores criados`);

  // Criar jogos
  let matchCount = 0;
  for (const m of cat.matches) {
    const compA = competitorMap.get(m.a);
    const compB = competitorMap.get(m.b);
    if (!compA || !compB) {
      console.error(`  ✗ Competitor não encontrado: ${!compA ? m.a : m.b}`);
      continue;
    }

    const winnerId = m.winner === "a" ? compA : compB;

    const sets = m.sets.map(([a, b]) => ({ a, b }));

    const status = m.status === "wo" ? "wo" : "finalizado";

    const { error: matchErr } = await supabase.from("matches").insert({
      category_id: categoryId,
      phase: m.phase,
      day: "2026-06-01", // data fictícia (torneio passado)
      time: "00:00",
      status,
      competitor_a: compA,
      competitor_b: compB,
      sets,
      winner_id: winnerId,
    });

    if (matchErr) {
      console.error(`  ✗ Erro no jogo ${m.a} vs ${m.b}:`, matchErr.message);
    } else {
      matchCount++;
    }
  }
  console.log(`  ✓ ${matchCount} jogos inseridos`);
}

console.log("\n✅ Importação concluída!");
