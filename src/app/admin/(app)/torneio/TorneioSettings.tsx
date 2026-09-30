"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDay } from "@/lib/tennis";
import { readAdminTidCookie, writeAdminTidCookie } from "@/lib/adminTournament";

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
  tournament_id: string;
}

export function TorneioSettings() {
  const [supabase] = useState(() => createClient());
  const [tours, setTours] = useState<Tour[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tourRes, courtRes] = await Promise.all([
      supabase.from("tournaments").select("id,name,club,edition,days").order("created_at"),
      supabase.from("courts").select("id,name,tournament_id").order("name"),
    ]);
    const t = (tourRes.data as Tour[]) ?? [];
    setTours(t);
    setCourts((courtRes.data as Court[]) ?? []);
    if (!selected && t.length > 0) {
      const cookieTid = readAdminTidCookie();
      setSelected(cookieTid && t.some((x) => x.id === cookieTid) ? cookieTid : t[0].id);
    }
    setLoading(false);
  }, [supabase, selected]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg((s) => (s === m ? null : s)), 1500);
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-live">{error}</p>}
      {msg && <p className="text-sm font-semibold text-accent">{msg}</p>}

      {/* Lista de torneios */}
      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Torneios cadastrados</h2>
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-lira-purple px-3 py-1.5 text-xs font-bold text-white"
          >
            + Novo torneio
          </button>
        </div>
        {tours.length === 0 && (
          <p className="text-xs text-muted">Nenhum torneio cadastrado.</p>
        )}
        <div className="space-y-2">
          {tours.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelected(t.id); writeAdminTidCookie(t.id); setCreating(false); }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selected === t.id && !creating
                  ? "border-lira-purple bg-lira-purple/10"
                  : "border-border bg-background hover:bg-lira-purple-soft/50"
              }`}
            >
              <p className="text-sm font-bold">{t.name}</p>
              <p className="text-xs text-muted">
                {t.club} · {t.edition ?? "—"} · {(t.days ?? []).length} dia(s)
              </p>
            </button>
          ))}
        </div>
      </section>

      {creating && (
        <NewTournamentForm
          supabase={supabase}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
            writeAdminTidCookie(id);
            load();
            flash("Torneio criado! Agora ele é o torneio em edição no painel.");
          }}
          onCancel={() => setCreating(false)}
          setError={setError}
        />
      )}

      {selected && !creating && (
        <TournamentEditor
          key={selected}
          supabase={supabase}
          tournamentId={selected}
          tours={tours}
          courts={courts.filter((c) => c.tournament_id === selected)}
          onUpdate={() => { load(); }}
          flash={flash}
          setError={setError}
        />
      )}
    </div>
  );
}

function NewTournamentForm({
  supabase,
  onCreated,
  onCancel,
  setError,
}: {
  supabase: ReturnType<typeof createClient>;
  onCreated: (id: string) => void;
  onCancel: () => void;
  setError: (e: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [club, setClub] = useState("Lira Tênis Clube");
  const [edition, setEdition] = useState(new Date().getFullYear().toString());
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome ao torneio.");
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ name: name.trim(), club: club.trim(), edition: edition.trim(), days: [] })
      .select("id")
      .single();
    if (error) {
      setError("Erro ao criar: " + error.message);
      setBusy(false);
      return;
    }
    onCreated(data.id);
  }

  return (
    <section className="rounded-xl border-2 border-lira-yellow/60 bg-card p-3">
      <h2 className="mb-2 text-sm font-bold">Novo torneio</h2>
      <form onSubmit={create} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Nome do torneio" value={name} onChange={setName} placeholder="Ex: III Lira Tennis Open" />
          <Field label="Clube" value={club} onChange={setClub} />
          <Field label="Edição/Ano" value={edition} onChange={setEdition} />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-lira-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Criando…" : "Criar torneio"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

function TournamentEditor({
  supabase,
  tournamentId,
  tours,
  courts,
  onUpdate,
  flash,
  setError,
}: {
  supabase: ReturnType<typeof createClient>;
  tournamentId: string;
  tours: Tour[];
  courts: Court[];
  onUpdate: () => void;
  flash: (m: string) => void;
  setError: (e: string | null) => void;
}) {
  const tour = tours.find((t) => t.id === tournamentId);
  const [name, setName] = useState(tour?.name ?? "");
  const [club, setClub] = useState(tour?.club ?? "");
  const [edition, setEdition] = useState(tour?.edition ?? "");
  const [newDay, setNewDay] = useState("");
  const [newCourt, setNewCourt] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!tour) return null;

  async function saveInfo() {
    const { error } = await supabase
      .from("tournaments")
      .update({ name, club, edition })
      .eq("id", tournamentId);
    if (error) return setError("Erro ao salvar.");
    setError(null);
    flash("Dados salvos!");
    onUpdate();
  }

  async function saveDays(days: string[]) {
    const sorted = Array.from(new Set(days)).sort();
    const { error } = await supabase.from("tournaments").update({ days: sorted }).eq("id", tournamentId);
    if (error) return setError("Erro ao salvar os dias: " + error.message);
    setError(null);
    onUpdate();
    flash("Dias atualizados!");
  }
  function addDay() {
    if (!newDay) return;
    saveDays([...(tour?.days ?? []), newDay]);
    setNewDay("");
  }
  function removeDay(d: string) {
    saveDays((tour?.days ?? []).filter((x) => x !== d));
  }

  async function addCourt(e: React.FormEvent) {
    e.preventDefault();
    const n = newCourt.trim();
    if (!n) return;
    const { error } = await supabase.from("courts").insert({ name: n, tournament_id: tournamentId });
    if (error) return setError("Erro ao adicionar a quadra: " + error.message);
    setError(null);
    setNewCourt("");
    onUpdate();
    flash("Quadra adicionada!");
  }
  async function removeCourt(id: string) {
    if (!confirm("Remover esta quadra?")) return;
    const { error } = await supabase.from("courts").delete().eq("id", id);
    if (error) return setError("Não foi possível remover: " + error.message);
    setError(null);
    onUpdate();
    flash("Quadra removida.");
  }

  async function deleteTournament() {
    const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
    if (error) return setError("Erro ao excluir: " + error.message);
    setError(null);
    flash("Torneio excluído.");
    onUpdate();
  }

  return (
    <>
      {/* Dados gerais */}
      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="mb-2 text-sm font-bold">Dados do torneio</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Nome do torneio" value={name} onChange={setName} />
          <Field label="Clube" value={club} onChange={setClub} />
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
        <h2 className="mb-1 text-sm font-bold">Quadras</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {courts.length === 0 && <span className="text-xs text-muted">Nenhuma quadra.</span>}
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
      </section>

      {/* Excluir */}
      <section className="rounded-xl border border-live/30 bg-card p-3">
        <h2 className="mb-1 text-sm font-bold text-live">Zona de perigo</h2>
        <p className="mb-2 text-xs text-muted">
          Excluir o torneio apaga todas as categorias, jogos e resultados dele.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-live/40 px-3 py-1.5 text-xs font-bold text-live"
          >
            Excluir torneio
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={deleteTournament}
              className="rounded-lg bg-live px-3 py-1.5 text-xs font-bold text-white"
            >
              Confirmar exclusão
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
      />
    </div>
  );
}
