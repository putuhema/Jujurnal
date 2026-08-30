import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jujurnal",
    short_name: "Jujurnal",
    description: "Write your thought, ease your mind.",
    start_url: "/",
    display: "standalone",
    theme_color: "#fcf6ea",
    background_color: "#fcf6ea",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
