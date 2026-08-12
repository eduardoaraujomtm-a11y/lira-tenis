-- Ajusta a ordem de exibição das categorias: M1, M2, M4, M5, FA, FB.
update public.categories set sort_order = case short_name
  when 'M1' then 1
  when 'M2' then 2
  when 'M4' then 3
  when 'M5' then 4
  when 'FA' then 5
  when 'FB' then 6
  else sort_order
end;
