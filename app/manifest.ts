import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Field Service",
    short_name: "Field App",
    description: "Mobile-first field service operations.",
    start_url: "/field",
    scope: "/",
    display: "standalone",
    background_color: "#f4f0e8",
    theme_color: "#17211c",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
