import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sessionside",
    short_name: "Sessionside",
    description: "School therapy session notes that turn into clean Medicaid claims.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#3b4fd8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
