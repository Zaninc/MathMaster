import { DomainMeter } from "@/components/learning/DomainMeter";
import { Badge } from "@/components/shared/Badge";
import { LEARNING_PREVIEW } from "@/data/learning-preview";

export function ProgressPreview() {
  return (
    <section className="border-b border-border py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-xl font-semibold text-text-primary">Seu progresso</h2>
          <Badge variant="preview" />
        </div>
        <div className="flex flex-col gap-6">
          {LEARNING_PREVIEW.map((item) => (
            <DomainMeter
              key={item.subject}
              subject={item.subject}
              percentage={item.percentage}
              message={item.message}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
