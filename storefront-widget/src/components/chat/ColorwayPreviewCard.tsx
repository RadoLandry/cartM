interface ColorwayPreviewCardProps {
  title?: string;
  changedLabel: string;
  status?: "ok" | "partial" | "invalid" | "fallback" | "error";
  currentAssetUrl?: string | null;
  proposedAssetUrl?: string | null;
  reused?: boolean;
  omissions?: Array<{
    lineId: string;
    scope?: "current" | "proposed" | "both";
    reasonCode: string;
    reasonDetail?: string;
  }>;
}

export function ColorwayPreviewCard({
  title = "Colorway preview",
  changedLabel,
  status = "ok",
  currentAssetUrl,
  proposedAssetUrl,
  reused = false,
  omissions = [],
}: ColorwayPreviewCardProps) {
  const statusMessage =
    status === "partial"
      ? "Preview is partial because some items could not be rendered."
      : status === "invalid"
        ? "Preview request is invalid. Select a different variant to continue."
        : status === "fallback"
          ? "Preview is unavailable for this cart configuration."
          : status === "error"
            ? "Preview failed. Try again in a moment."
            : "Preview generated successfully.";

  return (
    <section className="cm-guidance-card" aria-live="polite">
      <div className="cm-guidance-card__header">
        <h4>{title}</h4>
        <span className="cm-pill">{reused ? "Reused" : "Generated"}</span>
      </div>
      <p>{changedLabel}</p>
      <p>{statusMessage}</p>
      <div className="cm-colorway-preview-grid">
        <figure>
          <figcaption>Current</figcaption>
          {currentAssetUrl ? <img src={currentAssetUrl} alt="Current colorway preview" loading="lazy" /> : <p>Unavailable</p>}
        </figure>
        <figure>
          <figcaption>Proposed</figcaption>
          {proposedAssetUrl ? <img src={proposedAssetUrl} alt="Proposed colorway preview" loading="lazy" /> : <p>Unavailable</p>}
        </figure>
      </div>
      {omissions.length > 0 ? (
        <ul className="cm-guidance-list">
          {omissions.map((omission) => (
            <li key={`${omission.lineId}-${omission.reasonCode}-${omission.scope || "both"}`}>
              <strong>{omission.lineId}</strong>
              <span>
                {omission.reasonDetail || omission.reasonCode}
                {omission.scope ? ` (${omission.scope})` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
