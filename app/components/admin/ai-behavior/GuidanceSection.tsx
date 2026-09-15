import { TextField } from "@shopify/polaris";

export function GuidanceSection(props: {
  customGuidance: string;
  conversationStarters: string;
  onCustomGuidanceChange: (value: string) => void;
  onConversationStartersChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <TextField
        label="Store guidance"
        value={props.customGuidance}
        multiline={4}
        maxLength={2000}
        showCharacterCount
        autoComplete="off"
        onChange={props.onCustomGuidanceChange}
        disabled={props.disabled}
      />
      <TextField
        label="Conversation starters"
        helpText="Use one starter per line."
        value={props.conversationStarters}
        multiline={4}
        autoComplete="off"
        onChange={props.onConversationStartersChange}
        disabled={props.disabled}
      />
    </>
  );
}
