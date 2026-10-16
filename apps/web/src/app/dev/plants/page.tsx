import { notFound } from "next/navigation";
import { PlantLabLoader } from "@/components/plant-lab-loader";

// Development-only tool for tuning the procedural plants.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PlantLabLoader />;
}
