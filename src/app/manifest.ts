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
    background_color: "#143c28",
    theme_color: "#143c28",
    orientation: "portrait",
    icons: [
      { src: "/flow-icon-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/flow-icon-v2.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon-v2.png", sizes: "192x192", type: "image/png", purpose: "any" }
    ]
  };
}
