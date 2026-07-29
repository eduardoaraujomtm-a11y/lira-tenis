import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lira Tênis Clube · Torneio 100 Anos",
    short_name: "Lira Tênis",
    description:
      "Chaves, agenda, jogos ao vivo e resultados do Torneio 100 Anos do Lira Tênis Clube.",
    start_url: "/",
    display: "standalone",
    background_color: "#3b2a8c",
    theme_color: "#3b2a8c",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
