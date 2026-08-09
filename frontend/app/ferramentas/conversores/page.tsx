import type { Metadata } from "next";

import { ConvertersWorkspace } from "@/components/converters/ConvertersWorkspace";

export const metadata: Metadata = {
  title: "Conversores",
  description: "Converta unidades de comprimento, massa, área, volume, tempo, temperatura, velocidade e ângulo, com a matemática de cada conversão explicada.",
};

export default function ConversoresPage() {
  return <ConvertersWorkspace />;
}
