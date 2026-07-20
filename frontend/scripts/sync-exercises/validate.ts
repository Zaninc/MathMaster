import type { ExerciseDraft } from "../../data/exercises/types";

/**
 * Validação do catálogo — 100% pura e local, sem tocar no Supabase
 * (exceto `validateTopicReferences`, que recebe os slugs reais como
 * parâmetro em vez de consultar o banco ela mesma, continuando testável
 * sem I/O). Ver LEARNING_RULES.md §"Estrutura obrigatória".
 */

export interface ValidationError {
  /** Arquivo provável (data/exercises/<topicSlug>.ts) — inferido do topicSlug, já que cada tópico mora no seu próprio arquivo por convenção. */
  file: string;
  slug: string | null;
  message: string;
}

const VALID_DIFFICULTIES = new Set<string>(["facil", "medio", "dificil"]);

const ALLOWED_KEYS = new Set([
  "slug",
  "topicSlug",
  "difficulty",
  "position",
  "statement",
  "statementLatex",
  "choices",
  "correctIndex",
  "explanation",
]);

function fileFor(exercise: Partial<ExerciseDraft>): string {
  return exercise.topicSlug ? `data/exercises/${exercise.topicSlug}.ts` : "data/exercises/(topicSlug ausente)";
}

/** Validações estruturais de UM exercício — chamado por `validateCatalog` para cada item do catálogo. */
function validateOne(exercise: ExerciseDraft): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = fileFor(exercise);
  const slug = exercise.slug ?? null;

  const extraKeys = Object.keys(exercise).filter((key) => !ALLOWED_KEYS.has(key));
  if (extraKeys.length > 0) {
    errors.push({ file, slug, message: `campos não reconhecidos pelo schema do banco: ${extraKeys.join(", ")}` });
  }

  if (!exercise.slug || exercise.slug.trim() === "") {
    errors.push({ file, slug, message: "slug ausente" });
  }

  if (!exercise.topicSlug || exercise.topicSlug.trim() === "") {
    errors.push({ file, slug, message: "topicSlug ausente" });
  }

  if (!VALID_DIFFICULTIES.has(exercise.difficulty)) {
    errors.push({ file, slug, message: `dificuldade inválida: "${exercise.difficulty}" (esperado facil, medio ou dificil)` });
  }

  if (!exercise.statement || exercise.statement.trim() === "") {
    errors.push({ file, slug, message: "enunciado (statement) vazio" });
  }

  if (!Array.isArray(exercise.choices) || exercise.choices.length !== 4) {
    errors.push({
      file,
      slug,
      message: `quantidade inválida de alternativas: esperado 4, recebido ${Array.isArray(exercise.choices) ? exercise.choices.length : "não é array"}`,
    });
  } else {
    const hasEmpty = exercise.choices.some((choice) => typeof choice !== "string" || choice.trim() === "");
    if (hasEmpty) errors.push({ file, slug, message: "alternativa vazia" });

    const uniqueChoices = new Set(exercise.choices.map((choice) => choice?.trim()));
    if (uniqueChoices.size !== exercise.choices.length) {
      errors.push({ file, slug, message: "alternativas duplicadas" });
    }

    if (!Number.isInteger(exercise.correctIndex) || exercise.correctIndex < 0 || exercise.correctIndex > 3) {
      errors.push({ file, slug, message: `correctIndex fora dos limites: ${exercise.correctIndex} (esperado 0-3)` });
    }
  }

  if (!exercise.explanation || exercise.explanation.trim() === "") {
    errors.push({ file, slug, message: "explicação (explanation) vazia" });
  }

  if (!Number.isInteger(exercise.position) || exercise.position < 0) {
    errors.push({ file, slug, message: `posição inválida: ${exercise.position}` });
  }

  return errors;
}

/** Checa duplicidade de slug (catálogo inteiro) e de posição (dentro de cada tópico). */
function validateCrossReferences(catalog: ExerciseDraft[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenSlugs = new Map<string, number>();
  const positionsByTopic = new Map<string, Map<number, number>>();

  catalog.forEach((exercise) => {
    const file = fileFor(exercise);

    if (exercise.slug) {
      const count = seenSlugs.get(exercise.slug) ?? 0;
      if (count === 1) {
        errors.push({ file, slug: exercise.slug, message: `slug duplicado no catálogo: "${exercise.slug}"` });
      }
      seenSlugs.set(exercise.slug, count + 1);
    }

    if (exercise.topicSlug && Number.isInteger(exercise.position)) {
      const positions = positionsByTopic.get(exercise.topicSlug) ?? new Map<number, number>();
      const count = positions.get(exercise.position) ?? 0;
      if (count === 1) {
        errors.push({
          file,
          slug: exercise.slug ?? null,
          message: `posição ${exercise.position} duplicada no tópico "${exercise.topicSlug}"`,
        });
      }
      positions.set(exercise.position, count + 1);
      positionsByTopic.set(exercise.topicSlug, positions);
    }
  });

  return errors;
}

/** Valida o catálogo inteiro — nada aqui toca o Supabase. */
export function validateCatalog(catalog: ExerciseDraft[]): ValidationError[] {
  return [...catalog.flatMap(validateOne), ...validateCrossReferences(catalog)];
}

/**
 * Precisa dos tópicos REAIS do banco pra checar "tópico inexistente" —
 * continua pura/testável: o chamador injeta o conjunto de slugs
 * conhecidos (em produção, vem de uma consulta a `topics`; em teste, um
 * Set qualquer).
 */
export function validateTopicReferences(catalog: ExerciseDraft[], knownTopicSlugs: ReadonlySet<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const exercise of catalog) {
    if (exercise.topicSlug && !knownTopicSlugs.has(exercise.topicSlug)) {
      errors.push({
        file: fileFor(exercise),
        slug: exercise.slug ?? null,
        message: `tópico inexistente: "${exercise.topicSlug}" (crie o tópico no Supabase antes de sincronizar este exercício)`,
      });
    }
  }
  return errors;
}
