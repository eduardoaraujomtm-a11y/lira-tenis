"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDay } from "@/lib/tennis";

interface Tour {
  id: string;
  name: string;
  club: string;
  edition: string | null;
  days: string[];
}
interface Court {
  id: string;
  name: string;
}

export function TorneioSettings() {
  const [supabase] = useState(() => createClient());
  const [tour, setTour] = useState<Tour | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // campos editáveis
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [edition, setEdition] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newCourt, setNewCourt] = useState("");

  const load = useCallback(async () => {
    const [tourRes, courtRes] = await Promise.all([
      supabase.from("tournaments").select("id,name,club,edition,days").limit(1).single(),
      supabase.from("courts").select("id,name").order("name"),
    ]);
    const t = (tourRes.data as Tour) ?? null;
    setTour(t);
    if (t) {
      setName(t.name);
      setClub(t.club);
      setEdition(t.edition ?? "");
    }
    setCourts((courtRes.data as Court[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg((s) => (s === m ? null : s)), 1500);
  }

  async function saveInfo() {
    if (!tour) return;
    const { error } = await supabase
      .from("tournaments")
      .update({ name, club, edition })
      .eq("id", tour.id);
    if (error) return setError("Erro ao salvar. Você está logado?");
    setError(null);
    flash("Dados salvos!");
    load();
  }

  async function saveDays(days: string[]) {
    if (!tour) return;
    const sorted = Array.from(new Set(days)).sort();
    const { error } = await supabase.from("tournaments").update({ days: sorted }).eq("id", tour.id);
    if (error) return setError("Erro ao salvar os dias: " + error.message);
    setError(null);
    setTour({ ...tour, days: sorted });
    flash("Dias atualizados!");
  }
  function addDay() {
    if (!newDay || !tour) return;
    saveDays([...(tour.days ?? []), newDay]);
    setNewDay("");
  }
  function removeDay(d: string) {
    if (!tour) return;
    saveDays((tour.days ?? []).filter((x) => x !== d));
  }

  async function addCourt(e: React.FormEvent) {
    e.preventDefault();
    const n = newCourt.trim();
    if (!n || !tour) return;
    const { error } = await supabase.from("courts").insert({ name: n, tournament_id: tour.id });
    if (error) return setError("Erro ao adicionar a quadra: " + error.message);
    setError(null);
    setNewCourt("");
    await load();
    flash("Quadra adicionada!");
  }
  async function removeCourt(id: string) {
    if (!confirm("Remover esta quadra? Os jogos nela ficam sem quadra.")) return;
    const { error } = await supabase.from("courts").delete().eq("id", id);
    if (error) return setError("Não foi possível remover: " + error.message);
    setError(null);
    await load();
    flash("Quadra removida.");
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;
  if (!tour) return <p className="text-sm text-live">Torneio não encontrado.</p>;

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-live">{error}</p>}
      {msg && <p className="text-sm font-semibold text-accent">{msg}</p>}

      {/* Dados gerais */}
      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="mb-2 text-sm font-bold">Dados do torneio</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Clube" value={club} onChange={setClub} />
          <Field label="Nome do torneio" value={name} onChange={setName} />
          <Field label="Edição/Ano" value={edition} onChange={setEdition} />
        </div>
        <button
          onClick={saveInfo}
          className="mt-3 rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white"
        >
          Salvar dados
        </button>
      </section>

      {/* Dias */}
      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="mb-1 text-sm font-bold">Dias dos jogos</h2>
        <p className="mb-2 text-xs text-muted">
          As datas em que o torneio acontece. Aparecem como opções na Agenda e nos filtros.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {(tour.days ?? []).length === 0 && (
            <span className="text-xs text-muted">Nenhum dia definido ainda.</span>
          )}
          {(tour.days ?? []).map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full bg-lira-purple-soft px-3 py-1 text-xs font-medium text-accent"
            >
              {formatDay(d)}
              <button onClick={() => removeDay(d)} className="text-live" title="Remover">
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button
            onClick={addDay}
            disabled={!newDay}
            className="rounded-lg bg-lira-purple px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Adicionar dia
          </button>
        </div>
      </section>

      {/* Quadras */}
      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="mb-1 text-sm font-bold">Quadras do clube</h2>
        <p className="mb-2 text-xs text-muted">
          Quantas quadras você tem disponíveis. São usadas para alocar e agendar os jogos.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {courts.length === 0 && <span className="text-xs text-muted">Nenhuma quadra ainda.</span>}
          {courts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-lira-purple-soft px-3 py-1 text-xs font-medium text-accent"
            >
              {c.name}
              <button onClick={() => removeCourt(c.id)} className="text-live" title="Remover">
                ✕
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={addCourt} className="flex gap-2">
          <input
            value={newCourt}
            onChange={(e) => setNewCourt(e.target.value)}
            placeholder="Nova quadra (ex: Quadra 5)"
            className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-lg bg-lira-purple px-3 py-1.5 text-sm font-bold text-white">
            Adicionar
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">{courts.length} quadra(s) cadastrada(s).</p>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
      />
    </div>
  );
}
