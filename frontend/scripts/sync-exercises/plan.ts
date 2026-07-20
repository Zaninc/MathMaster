/**
 * Planejamento puro do sync — decide o que seria inserido/atualizado
 * comparando slugs locais com slugs remotos, sem nenhum side-effect.
 * Nunca sugere exclusão: exercícios remotos sem par local só entram em
 * `divergent` (relatado, nunca apagado — ver LEARNING_RULES.md).
 */
export interface SyncPlan {
  toInsert: string[];
  toUpdate: string[];
  /** Existe no banco mas não no catálogo local — só relatado. */
  divergent: string[];
}

export function planSync(localSlugs: readonly string[], remoteSlugs: ReadonlySet<string>): SyncPlan {
  const toInsert: string[] = [];
  const toUpdate: string[] = [];
  const localSet = new Set(localSlugs);

  for (const slug of localSlugs) {
    if (remoteSlugs.has(slug)) toUpdate.push(slug);
    else toInsert.push(slug);
  }

  const divergent = [...remoteSlugs].filter((slug) => !localSet.has(slug));

  return { toInsert, toUpdate, divergent };
}
