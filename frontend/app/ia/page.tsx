import type { Metadata } from "next";

import { MathMentorPreview } from "@/components/ai/MathMentorPreview";

export const metadata: Metadata = {
  title: "Math Mentor",
  description: "Conheça a proposta do Math Mentor — em desenvolvimento.",
};

export default function IaPage() {
  return <MathMentorPreview />;
}
