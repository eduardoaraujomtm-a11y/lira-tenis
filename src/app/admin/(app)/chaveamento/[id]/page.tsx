import { CategoriaManager } from "./CategoriaManager";

export default async function CategoriaChavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategoriaManager categoryId={id} />;
}
