/**
 * Renders JSON-LD. Server component by design — the markup must be present in
 * the initial HTML for crawlers that don't execute JavaScript.
 */
export default function StructuredData({ schema }: { schema: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
