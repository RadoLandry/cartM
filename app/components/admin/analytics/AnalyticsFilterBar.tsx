import { Card, FormLayout, TextField } from "@shopify/polaris";
import { useState } from "react";

export function AnalyticsFilterBar({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  return (
    <Card>
      <form method="get">
        <FormLayout>
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            value={start}
            onChange={setStart}
            autoComplete="off"
          />
          <TextField
            label="End date"
            name="endDate"
            type="date"
            value={end}
            onChange={setEnd}
            autoComplete="off"
          />
          <button type="submit">Apply filters</button>
        </FormLayout>
      </form>
    </Card>
  );
}
