export default function Loading() {
  return (
    <div style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Loading search…
      </div>
      <div style={{ opacity: 0.7 }}>
        Please wait while we fetch the latest catalogue.
      </div>
    </div>
  );
}
