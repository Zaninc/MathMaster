import { ALL_EXERCISES } from "../../data/exercises";
import { loadSyncEnv } from "./env";
import { runSync } from "./run";
import { createSupabaseAdminClient } from "./supabase-admin";

/**
 * Entrada de linha de comando (`npm run sync:exercises` /
 * `npm run sync:exercises -- --dry-run`). Só faz I/O e impressão — toda
 * a lógica de verdade (validação, plano, transformação) vive em
 * `run.ts`/`validate.ts`/`plan.ts`/`transform.ts`, testados sem tocar
 * banco nenhum. Ver `README.md` deste diretório e `LEARNING_RULES.md`.
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Catálogo local: ${ALL_EXERCISES.length} exercício(s).`);
  if (dryRun) console.log("Modo dry-run — nenhuma escrita será feita no Supabase.\n");

  const env = loadSyncEnv();
  const supabase = createSupabaseAdminClient(env);

  const result = await runSync({ catalog: ALL_EXERCISES, dryRun, supabase });

  if (!result.ok && result.validationErrors.length > 0) {
    console.error(`\n${result.validationErrors.length} erro(s) — nada foi enviado ao Supabase:\n`);
    for (const error of result.validationErrors) {
      console.error(`  [${error.file}]${error.slug ? ` (${error.slug})` : ""} ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const plan = result.plan!;

  if (dryRun) {
    console.log(`[dry-run] ${plan.toInsert.length} seriam inseridos:`);
    plan.toInsert.forEach((slug) => console.log(`  + ${slug}`));
    console.log(`\n[dry-run] ${plan.toUpdate.length} seriam atualizados:`);
    plan.toUpdate.forEach((slug) => console.log(`  ~ ${slug}`));
    if (plan.divergent.length > 0) {
      console.log(`\n[dry-run] ${plan.divergent.length} existem no banco mas não no catálogo local (não apagados):`);
      plan.divergent.forEach((slug) => console.log(`  ? ${slug}`));
    }
    console.log("\n[dry-run] nenhuma escrita foi feita.");
    return;
  }

  if (plan.divergent.length > 0) {
    console.log(`${plan.divergent.length} exercício(s) existem no banco mas não no catálogo local (não apagados):`);
    plan.divergent.forEach((slug) => console.log(`  ? ${slug}`));
    console.log("");
  }

  console.log(`${ALL_EXERCISES.length} exercícios validados`);
  console.log(`${plan.toInsert.length} inseridos`);
  console.log(`${plan.toUpdate.length} atualizados`);
  console.log(`${result.writeErrors} erros`);

  if (result.writeErrors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Falha inesperada no sync:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
