"use client";

import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/shared/Badge";
import {
  FUTURE_LEARNING_CONCEPTS,
  LEARNING_PREVIEW,
  STRENGTH_THRESHOLD,
  STREAK_DAYS_PREVIEW,
} from "@/data/learning-preview";
import { apiClient } from "@/lib/api/client";
import type { HistoryItem } from "@/lib/api/types";

import { DomainMeter } from "./DomainMeter";

/**
 * "Seu aprendizado" é 100% preview — decisão da auditoria: a Learning
 * Engine ainda não existe no backend, então TODO dado de domínio/streak/
 * recomendação aqui vem de `data/learning-preview.ts` (claramente
 * demonstrativo, nunca fabricado como se fosse real). A única seção
 * genuinamente real é "Atividade recente", que reaproveita `/history`
 * (mesma ressalva de honestidade já usada em `HistoryPanel`: compartilhado
 * da instância, não uma conta pessoal).
 */
export function LearningDashboard() {
  const [recentActivity, setRecentActivity] = useState<HistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHistory()
      .then((items) => {
        if (!cancelled) setRecentActivity(items.slice(0, 5));
      })
      .catch(() => {
        // atividade recente é secundária: falha silenciosa não deve quebrar a tela
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const averageDomain = Math.round(
    LEARNING_PREVIEW.reduce((sum, item) => sum + item.percentage, 0) / LEARNING_PREVIEW.length
  );
  const strengths = LEARNING_PREVIEW.filter((item) => item.percentage >= STRENGTH_THRESHOLD);
  const attentionPoints = LEARNING_PREVIEW.filter((item) => item.percentage < STRENGTH_THRESHOLD);
  const nextStep = [...LEARNING_PREVIEW].sort((a, b) => a.percentage - b.percentage)[0];

  return (
    <PageShell className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">Seu aprendizado</h1>
          <Badge variant="preview" />
        </div>
        <p className="max-w-2xl text-sm text-text-secondary">
          Esta página mostra a visão de produto da futura Learning Engine com dados demonstrativos — ainda não
          reflete seu uso real. Assim que a engine existir, cada número aqui vira medição real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Domínio médio (preview)</span>
          <p className="mt-1 text-3xl font-semibold text-text-primary">{averageDomain}%</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Sequência de estudos (preview)
          </span>
          <p className="mt-1 text-3xl font-semibold text-text-primary">{STREAK_DAYS_PREVIEW} dias</p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Domínio por área</h2>
        <div className="flex flex-col gap-6">
          {LEARNING_PREVIEW.map((item) => (
            <DomainMeter key={item.subject} subject={item.subject} percentage={item.percentage} message={item.message} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-success">Pontos fortes</h2>
          <ul className="flex flex-col gap-1 text-sm text-text-secondary">
            {strengths.map((item) => (
              <li key={item.subject}>
                {item.subject} — {item.percentage}%
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-warning">Pontos de atenção</h2>
          <ul className="flex flex-col gap-1 text-sm text-text-secondary">
            {attentionPoints.map((item) => (
              <li key={item.subject}>
                {item.subject} — {item.percentage}%
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-accent/40 bg-accent/10 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Próximo passo recomendado (preview)
        </span>
        <p className="mt-1 text-text-primary">{nextStep.message}</p>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Atividade recente</h2>
          <p className="text-xs text-text-muted">
            Esta seção é real (via histórico do backend), compartilhada por quem está usando esta instância agora —
            ainda não é uma conta pessoal.
          </p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma expressão resolvida ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentActivity.map((item) => (
              <li key={item.timestamp} className="rounded-md border border-border bg-surface p-3 text-sm text-text-primary">
                {item.expression} = {item.result}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">O futuro da Learning Engine</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FUTURE_LEARNING_CONCEPTS.map((concept) => (
            <div key={concept.title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">{concept.title}</h3>
                <Badge variant="planned" />
              </div>
              <p className="text-sm text-text-secondary">{concept.description}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
