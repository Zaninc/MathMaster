"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NavAuth } from "@/components/auth/NavAuth";
import { Badge } from "@/components/shared/Badge";
import { NAV_ITEMS } from "@/data/nav";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface IndicatorRect {
  left: number;
  width: number;
}

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navListRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  useEffect(() => {
    function measure() {
      const activeItem = NAV_ITEMS.find((item) => isActive(pathname, item.href));
      const container = navListRef.current;
      const link = activeItem ? linkRefs.current.get(activeItem.href) : undefined;
      if (!container || !link) {
        setIndicator(null);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      setIndicator({ left: linkRect.left - containerRect.left, width: linkRect.width });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-base font-semibold tracking-tight text-text-primary">
          MathMaster
        </Link>

        <nav aria-label="Navegação principal" className="hidden md:block">
          {/*
            Indicador deslizante: medido via ref (getBoundingClientRect do
            link ativo relativo ao container), não estimado — por isso
            precisa do useEffect acima. `left`/`width` (não
            `transform: translateX/scaleX`) foi a escolha deliberada aqui:
            é um único elemento pequeno que só se move em cliques de
            navegação (evento raro, nunca em loop/scroll), então o ganho
            de performance de um transform composto não paga a
            complexidade extra de normalizar uma escala-base.
          */}
          <ul ref={navListRef} className="relative flex items-center gap-1">
            {indicator && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-[left,width] duration-(--motion-base) ease-(--motion-easing)"
                style={{ left: indicator.left, width: indicator.width }}
              />
            )}
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    ref={(node) => {
                      if (node) linkRefs.current.set(item.href, node);
                      else linkRefs.current.delete(item.href);
                    }}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-(--motion-fast)",
                      active
                        ? "text-text-primary bg-surface-elevated"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface"
                    )}
                  >
                    {item.label}
                    {item.badge && <Badge variant={item.badge} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden md:block">
            <NavAuth variant="desktop" />
          </span>
          <button
            type="button"
            className="rounded-md border border-border p-2 text-text-secondary md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span aria-hidden="true">{mobileOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Navegação principal (mobile)" className="border-t border-border md:hidden">
          <ul className="flex flex-col px-4 py-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium",
                      active ? "text-text-primary" : "text-text-secondary"
                    )}
                  >
                    {item.label}
                    {item.badge && <Badge variant={item.badge} />}
                  </Link>
                </li>
              );
            })}
            <li>
              <NavAuth variant="mobile" onNavigate={() => setMobileOpen(false)} />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
