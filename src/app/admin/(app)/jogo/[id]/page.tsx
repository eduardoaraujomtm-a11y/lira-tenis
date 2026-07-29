import { MesaJogo } from "./MesaJogo";

export default async function JogoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MesaJogo matchId={id} />;
}
