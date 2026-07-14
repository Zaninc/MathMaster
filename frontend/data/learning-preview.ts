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

/** Limiar simples para separar "ponto forte" de "ponto de atenção" nos dados demonstrativos acima. */
export const STRENGTH_THRESHOLD = 70;

/** Dado demonstrativo isolado (sem histórico real de sequência de estudos ainda). */
export const STREAK_DAYS_PREVIEW = 5;

export interface FutureConcept {
  title: string;
  description: string;
}

export const FUTURE_LEARNING_CONCEPTS: FutureConcept[] = [
  { title: "Learning Graph", description: "Mapa de conceitos e pré-requisitos conectados ao seu progresso real." },
  { title: "Confidence Engine", description: "Nível de confiança por resposta, não só certo/errado." },
  { title: "Trilhas adaptativas", description: "Sequência de estudo que se ajusta ao seu ritmo e às suas lacunas." },
  { title: "Recomendações inteligentes", description: "Sugestões geradas a partir do que você já praticou de verdade." },
];
