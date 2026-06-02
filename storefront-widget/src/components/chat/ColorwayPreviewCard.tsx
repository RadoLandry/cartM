interface ColorwayPreviewCardProps {
  title?: string;
  changedLabel: string;
  currentAssetUrl?: string | null;
  proposedAssetUrl?: string | null;
  reused?: boolean;
}

export function ColorwayPreviewCard({
  title = "Colorway preview",
  changedLabel,
  currentAssetUrl,
  proposedAssetUrl,
  reused = false,
}: ColorwayPreviewCardProps) {
  return (
    <section className="cm-guidance-card" aria-live="polite">
      <div className="cm-guidance-card__header">
        <h4>{title}</h4>
        <span className="cm-pill">{reused ? "Reused" : "Generated"}</span>
      </div>
      <p>{changedLabel}</p>
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
    </section>
  );
}
