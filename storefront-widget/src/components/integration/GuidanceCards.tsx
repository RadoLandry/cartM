import type { StorefrontGuidancePayload } from "../../../../app/lib/ai/schemas";

interface GuidanceCardsProps {
  guidance?: StorefrontGuidancePayload;
}

export function GuidanceCards({ guidance }: GuidanceCardsProps) {
  if (!guidance) {
    return null;
  }

  const hasGuidance = guidance.recommendations.length > 0
    || guidance.sizeWarnings.length > 0
    || Boolean(guidance.kitCompleteness)
    || Boolean(guidance.fallbackNotice);

  if (!hasGuidance) {
    return null;
  }

  return (
    <section className="cm-surface__guidance" aria-label="CartMind guidance">
      {guidance.fallbackNotice ? (
        <article className="cm-surface-card cm-surface-card--fallback" role="status">
          <strong>{guidance.fallbackNotice.title}</strong>
          <p>{guidance.fallbackNotice.message}</p>
        </article>
      ) : null}

      {guidance.kitCompleteness ? (
        <article className="cm-surface-card" aria-label="Kit completeness">
          <div className="cm-surface-card__header">
            <strong>Kit completeness</strong>
            <span>{Math.round(guidance.kitCompleteness.score * 100)}%</span>
          </div>
          <p>{guidance.kitCompleteness.summary}</p>
          {guidance.kitCompleteness.missingCount > 0 ? (
            <small>{guidance.kitCompleteness.missingCount} missing item{guidance.kitCompleteness.missingCount === 1 ? "" : "s"}</small>
          ) : null}
        </article>
      ) : null}

      {guidance.sizeWarnings.map((warning) => (
        <article className={`cm-surface-card cm-surface-card--${warning.severity}`} key={warning.warningId}>
          <strong>{warning.title}</strong>
          <p>{warning.message}</p>
        </article>
      ))}

      {guidance.recommendations.map((recommendation) => (
        <article className="cm-surface-card" key={recommendation.guidanceId}>
          <div className="cm-surface-card__header">
            <strong>{recommendation.title}</strong>
            {recommendation.priceLabel ? <span>{recommendation.priceLabel}</span> : null}
          </div>
          <p>{recommendation.message}</p>
        </article>
      ))}
    </section>
  );
}