import Link from "next/link";

import { Badge } from "@/components/shared/Badge";
import type { Tool } from "@/data/tools";

export function ToolCard({ tool }: { tool: Tool }) {
  const content = (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{tool.title}</h3>
        {tool.status === "live" ? (
          <span className="text-xs font-medium text-success">Disponível</span>
        ) : (
          <Badge variant="planned">{tool.version ? `Planejado — ${tool.version}` : "Planejado"}</Badge>
        )}
      </div>
      <p className="text-sm text-text-secondary">{tool.description}</p>
    </div>
  );

  if (tool.status === "live" && tool.href) {
    return (
      <Link href={tool.href} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
