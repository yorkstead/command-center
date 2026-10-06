import type { MetadataRoute } from "next";

// Lets Chrome (and Edge, Android) install Command Center as its own app window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Yorkstead Command Center",
    short_name: "Command Center",
    description: "Yorkstead's tasks, pipeline, meetings and clients.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#141b22",
    theme_color: "#141b22",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Work", url: "/work" },
      { name: "Pipeline", url: "/pipeline" },
      { name: "Meetings", url: "/meetings" },
    ],
  };
}
