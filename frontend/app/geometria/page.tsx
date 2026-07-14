import type { Metadata } from "next";

import { GeometryWorkspace } from "@/components/geometry/GeometryWorkspace";

export const metadata: Metadata = {
  title: "Geometria",
  description: "Construa triângulos, círculos, retas e cônicas com visualização e o motor de geometria do MathMaster.",
};

export default function GeometriaPage() {
  return <GeometryWorkspace />;
}
