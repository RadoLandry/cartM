import type { ReactNode } from "react";

import type { StorefrontChatMountConfig } from "../../types";
import { GuidanceCards } from "./GuidanceCards";

interface CartMindSurfaceProps {
  config: StorefrontChatMountConfig;
  children: ReactNode;
}

export function CartMindSurface({ config, children }: CartMindSurfaceProps) {
  const guidance = config.guidance;
  const features = config.features ?? {
    showRecommendations: true,
    showKitCompleteness: true,
    showSizeWarnings: true,
    showChatEntry: true,
    showReasonTags: true,
  };
  const filteredGuidance = guidance
    ? {
        ...guidance,
        recommendations: features.showRecommendations ? guidance.recommendations : [],
        kitCompleteness: features.showKitCompleteness ? guidance.kitCompleteness : undefined,
        sizeWarnings: features.showSizeWarnings ? guidance.sizeWarnings : [],
      }
    : undefined;

  return (
    <section
      className={`cm-surface cm-surface--${config.surface}`}
      data-cartmind-surface={config.surface}
      data-cartmind-placement-id={config.placementId ?? `${config.surface}:default`}
    >
      <header className="cm-surface__header">
        <strong>CartMind</strong>
        <span>{config.surface === "cart_drawer" ? "Cart drawer guidance" : "Cart page guidance"}</span>
      </header>
      <GuidanceCards guidance={filteredGuidance} />
      {features.showChatEntry ? (
        <div className="cm-surface__chat-entry">
          {children}
        </div>
      ) : null}
    </section>
  );
}