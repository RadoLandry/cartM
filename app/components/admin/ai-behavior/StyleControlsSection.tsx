import { RangeSlider, Select } from "@shopify/polaris";

export function StyleControlsSection(props: {
  tone: string;
  aggressiveness: number;
  onToneChange: (tone: string) => void;
  onAggressivenessChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <Select
        label="Assistant tone"
        options={[
          { label: "Professional", value: "PROFESSIONAL" },
          { label: "Friendly", value: "FRIENDLY" },
          { label: "Concise", value: "CONCISE" },
          { label: "Coaching", value: "COACHING" },
        ]}
        value={props.tone}
        onChange={props.onToneChange}
        disabled={props.disabled}
      />
      <RangeSlider
        label="Recommendation aggressiveness"
        min={0}
        max={1}
        step={0.05}
        value={props.aggressiveness}
        onChange={(value) => props.onAggressivenessChange(Number(value))}
        output
        disabled={props.disabled}
      />
    </>
  );
}
