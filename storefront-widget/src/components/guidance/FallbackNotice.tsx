import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface FallbackNoticeProps {
  block: Extract<StructuredGuidanceBlock, { type: "fallback_notice" }>;
}

export function FallbackNotice({ block }: FallbackNoticeProps) {
  const model = getGuidanceRenderModel(block);

  return (
    <section className="cm-guidance-card cm-guidance-card--fallback">
      <h4>{model.title}</h4>
      <p>{model.summary}</p>
    </section>
  );
}