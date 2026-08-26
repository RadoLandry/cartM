export type SyncFailureRow = {
  failureReason: string;
  productId: string;
  productTitle: string;
};

export function SyncFailureTable({
  rows,
  failedCount = 0,
}: {
  rows: SyncFailureRow[];
  failedCount?: number;
}) {
  if (rows.length === 0 && failedCount === 0) {
    return null;
  }

  return (
    <s-stack direction="block" gap="base">
      <s-paragraph>
        <strong>
          {failedCount} product{failedCount !== 1 ? "s" : ""} failed during the last sync.
        </strong>{" "}
        Re-run a catalog sync to retry.
      </s-paragraph>
      {rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Product</th>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Shopify ID</th>
              <th style={{ textAlign: "left", padding: "0.25rem 0.5rem" }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId}>
                <td style={{ padding: "0.25rem 0.5rem" }}>{r.productTitle}</td>
                <td style={{ padding: "0.25rem 0.5rem" }}>{r.productId}</td>
                <td style={{ padding: "0.25rem 0.5rem" }}>{r.failureReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </s-stack>
  );
}
