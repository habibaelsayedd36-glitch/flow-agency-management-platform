import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FLOW Client Portal",
    short_name: "FLOW",
    description: "Your FLOW Agency workspace for products, projects, approvals and client agreements.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7ec",
    theme_color: "#143c28",
    orientation: "portrait",
    icons: [
      { src: "/flow-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/flow-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/flow-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
