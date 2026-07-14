import type { Metadata } from "next";

import { LearningDashboard } from "@/components/learning/LearningDashboard";

export const metadata: Metadata = {
  title: "Aprendizado",
  description: "Uma prévia de como o MathMaster vai acompanhar seu domínio por área e recomendar seus próximos passos.",
};

export default function AprendizadoPage() {
  return <LearningDashboard />;
}
