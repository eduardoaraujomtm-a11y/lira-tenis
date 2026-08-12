import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname, "../.env.local");
const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
    const eq = l.indexOf("=");
    return [l.slice(0, eq).trim(), l.slice(eq + 1).trim().replace(/^"|"$/g, "")];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Renomear Feminino → Feminino A ----
const { data: femCat } = await supabase
  .from("categories")
  .select("id,name")
  .eq("name", "Simples - Feminino")
  .maybeSingle();

if (femCat) {
  await supabase.from("categories").update({ name: "Simples - Feminino A", short_name: "SFA" }).eq("id", femCat.id);
  console.log("✓ Renomeado 'Simples - Feminino' → 'Simples - Feminino A' (SFA)");
}

// ---- Atletas ----
const { data: existingAthletes } = await supabase.from("athletes").select("id,name");
const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const athleteByName = new Map(existingAthletes.map((a) => [normalize(a.name), a.id]));

const ALIASES = {
  "Andre Vargas": "André Vargas",
};

async function ensureAthlete(name) {
  const resolved = ALIASES[name] ?? name;
  let id = athleteByName.get(normalize(resolved));
  if (id) return id;
  const { data, error } = await supabase.from("athletes").insert({ name: resolved }).select("id").single();
  if (error) { console.error(`  ✗ ${resolved}:`, error.message); return null; }
  athleteByName.set(normalize(resolved), data.id);
  console.log(`  + ${resolved} criado`);
  return data.id;
}

const newNames = ["Fernando Melo", "Tercia", "Mariana Macedo", "Fran Koerich", "Jozi Bonatti"];
for (const n of newNames) await ensureAthlete(n);

// ---- Torneio ----
const { data: tournament } = await supabase
  .from("tournaments").select("id").eq("name", "I Lira Tennis Open").single();
const tournamentId = tournament.id;

const { data: maxCat } = await supabase
  .from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
let sortOrder = (maxCat?.sort_order ?? 0) + 1;

const RULE = { bestOfSets: 3, gamesPerSet: 6, tiebreakTo: 7, superTiebreak: true, superTiebreakTo: 10, noAd: false };

// ============ VIP ============
const VIP = {
  name: "Simples - VIP",
  shortName: "SV",
  players: ["Andre Dias", "Gustavo Cunha", "Fernando Melo", "Rodrigo Sanita", "Andre Vargas"],
  matches: [
    // Scores always [a_score, b_score]
    { a: "Andre Dias", b: "Gustavo Cunha", sets: [[6,1],[6,2]], winner: "a" },
    { a: "Fernando Melo", b: "Rodrigo Sanita", sets: [[6,0],[6,1]], winner: "a" },
    { a: "Andre Dias", b: "Andre Vargas", sets: [[6,3],[6,4]], winner: "a" },
    { a: "Gustavo Cunha", b: "Fernando Melo", sets: [[0,6],[1,6]], winner: "b" },
    { a: "Gustavo Cunha", b: "Rodrigo Sanita", sets: [[2,6],[3,6]], winner: "b" },
    { a: "Fernando Melo", b: "Andre Vargas", sets: [[6,2],[6,3]], winner: "a" },
    { a: "Andre Dias", b: "Fernando Melo", sets: [[0,0]], winner: "b", status: "wo" },
    { a: "Gustavo Cunha", b: "Andre Vargas", sets: [[6,4],[1,6],[5,10]], winner: "b" },
    { a: "Rodrigo Sanita", b: "Andre Vargas", sets: [[0,0]], winner: "b", status: "wo" },
    { a: "Andre Dias", b: "Rodrigo Sanita", sets: [[6,3],[6,4]], winner: "a" },
  ],
};

// ============ Feminino B ============
const FEMB = {
  name: "Simples - Feminino B",
  shortName: "SFB",
  players: ["Tercia", "Mariana Macedo", "Fran Koerich", "Jozi Bonatti"],
  matches: [
    { a: "Fran Koerich", b: "Jozi Bonatti", sets: [[4,6],[4,6]], winner: "b" },
    { a: "Mariana Macedo", b: "Tercia", sets: [[6,3],[6,3]], winner: "a" },
    { a: "Tercia", b: "Jozi Bonatti", sets: [[7,5],[6,2]], winner: "a" },
    { a: "Mariana Macedo", b: "Jozi Bonatti", sets: [[6,3],[6,3]], winner: "a" },
    { a: "Tercia", b: "Fran Koerich", sets: [[6,4],[3,6],[10,4]], winner: "a" },
    { a: "Mariana Macedo", b: "Fran Koerich", sets: [[6,4],[6,4]], winner: "a" },
  ],
};

for (const cat of [VIP, FEMB]) {
  console.log(`\n📁 ${cat.name}`);

  const { data: catData, error: catErr } = await supabase
    .from("categories")
    .insert({
      tournament_id: tournamentId,
      name: cat.name,
      short_name: cat.shortName,
      type: "simples",
      format: "grupos",
      rule: RULE,
      sort_order: sortOrder++,
      qualifiers_per_group: 2,
    })
    .select("id")
    .single();

  if (catErr) { console.error("  ✗ Categoria:", catErr.message); continue; }
  const categoryId = catData.id;
  console.log(`  ✓ Categoria criada: ${categoryId}`);

  // Create a single group
  const groupId = crypto.randomUUID();

  const competitorMap = new Map();
  for (const name of cat.players) {
    const athleteId = await ensureAthlete(name);
    if (!athleteId) continue;
    const { data: compData } = await supabase
      .from("competitors")
      .insert({ category_id: categoryId, group_id: groupId })
      .select("id")
      .single();
    await supabase.from("competitor_athletes").insert({
      competitor_id: compData.id, athlete_id: athleteId, position: 1,
    });
    competitorMap.set(name, compData.id);
  }
  console.log(`  ✓ ${competitorMap.size} competidores criados`);

  let matchCount = 0;
  for (const m of cat.matches) {
    const compA = competitorMap.get(m.a);
    const compB = competitorMap.get(m.b);
    if (!compA || !compB) { console.error(`  ✗ ${m.a} ou ${m.b} não encontrado`); continue; }

    const winnerId = m.winner === "a" ? compA : compB;
    const sets = m.sets.map(([a, b]) => ({ a, b }));
    const status = m.status === "wo" ? "wo" : "finalizado";

    const { error } = await supabase.from("matches").insert({
      category_id: categoryId,
      phase: "grupo",
      group_id: groupId,
      round: null,
      day: "2026-06-01",
      time: "00:00",
      status,
      competitor_a: compA,
      competitor_b: compB,
      sets,
      winner_id: winnerId,
    });
    if (error) console.error(`  ✗ ${m.a} vs ${m.b}:`, error.message);
    else matchCount++;
  }
  console.log(`  ✓ ${matchCount} jogos inseridos`);
}

console.log("\n✅ Importação concluída!");
