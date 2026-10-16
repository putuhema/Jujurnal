import { notFound } from "next/navigation";
import { WorldPreview } from "@/components/world-preview";

// Development-only: the home garden and world view with sample gardens.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <WorldPreview />;
}
