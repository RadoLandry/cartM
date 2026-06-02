interface KitPreviewCardProps {
  title?: string;
  imageUrl: string;
  reused?: boolean;
  inferredDiscipline?: string | null;
  layoutId?: string;
  omissions?: Array<{
    lineId: string;
    reasonCode: string;
    reasonDetail?: string;
  }>;
}

export function KitPreviewCard({
  title = "Kit preview",
  imageUrl,
  reused = false,
  inferredDiscipline = null,
  layoutId,
  omissions = [],
}: KitPreviewCardProps) {
  const mixedContext = !inferredDiscipline;

  return (
    <section className="cm-guidance-card" aria-live="polite">
      <div className="cm-guidance-card__header">
        <h4>{title}</h4>
        <span className="cm-pill">{reused ? "Reused" : "Generated"}</span>
      </div>
      <p>
        {mixedContext
          ? "Mixed-discipline context preview"
          : `Discipline: ${inferredDiscipline}`}
      </p>
      {layoutId ? <small>Layout: {layoutId}</small> : null}
      <img
        src={imageUrl}
        alt="Composed kit preview"
        className="cm-kit-preview-image"
        loading="lazy"
      />
      {omissions.length > 0 ? (
        <ul className="cm-guidance-list">
          {omissions.map((omission) => (
            <li key={`${omission.lineId}-${omission.reasonCode}`}>
              <strong>{omission.lineId}</strong>
              <span>{omission.reasonDetail || omission.reasonCode}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
