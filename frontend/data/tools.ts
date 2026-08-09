export interface Tool {
  title: string;
  description: string;
  status: "live" | "planned";
  href?: string;
  version?: string;
}

/**
 * "live" só quando a ferramenta realmente funciona hoje — nada de
 * funcionalidade falsa (decisão explícita do briefing). Histórico e
 * Fórmulas apontam pra suas próprias páginas; "Banco de questões" (Hotfix
 * — Card funcional em Ferramentas) aponta pra `/aprendizado`, que já É a
 * fonte única de exercícios do produto — nenhuma página nova de banco de
 * questões foi criada, o card só passou a linkar pro que já existe.
 * "Conversores" (Sprint V2.20) ganhou página própria (`/ferramentas/
 * conversores`) — descrição atualizada de "Unidades, bases numéricas e
 * notações matemáticas" (a versão "planejada") pra refletir só o que
 * esta versão realmente entrega (conversão de unidades); bases numéricas
 * e notações matemáticas continuam fora de escopo, não prometidas mais.
 */
export const TOOLS: Tool[] = [
  {
    title: "Histórico",
    description: "Reveja as expressões já resolvidas nesta instância e reutilize qualquer uma delas.",
    status: "live",
    href: "/dashboard/historico",
  },
  {
    title: "Fórmulas",
    description: "Referência rápida das fórmulas mais usadas em álgebra, geometria, trigonometria e cálculo.",
    status: "live",
    href: "/formulas",
  },
  {
    title: "Simulados",
    description: "Provas cronometradas com correção automática.",
    status: "planned",
    version: "V1.1",
  },
  {
    title: "Caderno de questões",
    description: "Monte listas de exercícios e acompanhe seu progresso nelas.",
    status: "planned",
    version: "V1.1",
  },
  {
    title: "Banco de questões",
    description: "Explore questões organizadas por tópico e dificuldade.",
    status: "live",
    href: "/aprendizado",
  },
  {
    title: "Revisão rápida",
    description: "Resumo dos conceitos que você praticou recentemente.",
    status: "planned",
    version: "V1.5",
  },
  {
    title: "Exportar resolução",
    description: "Baixe o passo a passo de uma resolução em PDF.",
    status: "planned",
    version: "V1.5",
  },
  {
    title: "Plano de estudos",
    description: "Um roteiro de estudo gerado a partir do seu progresso real.",
    status: "planned",
    version: "V1.5",
  },
  {
    title: "Conversores",
    description: "Converta unidades e veja como o cálculo é feito.",
    status: "live",
    href: "/ferramentas/conversores",
  },
];
