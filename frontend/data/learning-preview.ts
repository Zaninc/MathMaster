export interface LearningPreviewItem {
  subject: string;
  percentage: number;
  message: string;
}

/**
 * Dados demonstrativos — NÃO vêm do backend (a Learning Engine ainda não
 * existe). Usado apenas para mostrar a visão do produto na Home; a página
 * real de Aprendizado (Etapa 5) repete esse rótulo "Preview" em qualquer
 * lugar que use estes dados.
 */
export const LEARNING_PREVIEW: LearningPreviewItem[] = [
  { subject: "Álgebra", percentage: 92, message: "Você demonstra domínio consistente." },
  {
    subject: "Trigonometria",
    percentage: 58,
    message: "Identidades trigonométricas ainda precisam de revisão.",
  },
  { subject: "Cálculo", percentage: 24, message: "Você começou bem. Revise limites antes de avançar." },
  { subject: "Geometria", percentage: 71, message: "Bom desempenho em distância e ponto médio." },
];
