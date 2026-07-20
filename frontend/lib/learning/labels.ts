import type { ConfidenceLevel, TopicStanding } from "./metrics";

/**
 * Labels/estilos de apresentação da Learning Engine, compartilhados entre
 * LearningStats (página Aprendizado) e TopicProgress (Dashboard) — uma
 * fonte só para não divergir texto/cor do mesmo standing em duas telas.
 */
export const STANDING_BADGES: Record<Exclude<TopicStanding, "neutro">, { label: string; className: string }> = {
  forte: { label: "Ponto forte", className: "border-success/40 text-success" },
  fraco: { label: "Precisa de atenção", className: "border-warning/40 text-warning" },
  "nao-iniciado": { label: "Não iniciado", className: "border-border text-text-muted" },
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  baixa: "baixa",
  media: "média",
  alta: "alta",
};

export const METER_MESSAGES: Record<TopicStanding, string> = {
  forte: "Você domina este tópico.",
  fraco: "Continue praticando para subir o domínio.",
  neutro: "Bom ritmo — siga praticando.",
  "nao-iniciado": "",
};
