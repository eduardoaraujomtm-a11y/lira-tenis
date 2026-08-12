-- Rótulos posicionais dos confrontos de mata-mata.
-- Enquanto a fase de grupos não termina, não sabemos QUEM joga a quartas/semi.
-- Estes campos guardam a previsão ("2º do Grupo B", "Vencedor Quartas 1") para
-- que a chave e o PDF mostrem os cruzamentos possíveis desde o início.
alter table public.matches
  add column if not exists label_a text,
  add column if not exists label_b text;
