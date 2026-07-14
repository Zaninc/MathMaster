export interface NavItem {
  label: string;
  href: string;
  badge?: "dev";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Início", href: "/" },
  { label: "Calculadora", href: "/calculadora" },
  { label: "Gráficos", href: "/graficos" },
  { label: "Aprendizado", href: "/aprendizado" },
  { label: "Geometria", href: "/geometria" },
  { label: "Ferramentas", href: "/ferramentas" },
  { label: "IA", href: "/ia", badge: "dev" },
];
