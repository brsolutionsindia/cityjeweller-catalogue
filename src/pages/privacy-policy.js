export default function PrivacyPolicy() {
  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "auto" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Effective Date:</strong> 22 June 2025</p>
      <p><strong>App Name:</strong> Jewellers Cataloging App</p>
      <p><strong>Company:</strong> BR Solutions Pvt Ltd</p>
      <p><strong>Website:</strong> www.cityjeweller.in</p>
      <p><strong>Contact:</strong> cityjeweller.india@gmail.com</p>

      <h2>1. Introduction</h2>
<p>This Privacy Policy explains how the City Jeweller app collects, uses, and protects user data. BR Solutions Pvt Ltd respects your privacy and ensures data is handled securely and transparently.</p>

      <h2>2. What Data We Collect</h2>
      <ul>
        <li>Images: Accessed via READ_MEDIA_IMAGES, only when users upload product images for SKUs.</li>
        <li>Cloud Sync: Limited Cataloging specific data may be synced to Firebase Realtime Database and Storage for backup and access across devices.</li>
        <li>Device Info (Non-personal): For app analytics and crash diagnostics.</li>
      </ul>

      <h2>3. Why We Collect It</h2>
      <ul>
        <li>To manage jewelry inventory</li>
        <li>To generate shareable catalogs and invoices</li>
        <li>To sync data across devices (where Firebase is used)</li>
        <li>To enhance user experience and app performance</li>
      </ul>

      <h2>4. Data Sharing</h2>
      <p>We do not share your data with advertisers or third-party services, except Firebase (Google Cloud) used for syncing and backup.</p>

      <h2>5. Security & Retention</h2>
      <p>Data is stored securely. Local data is retained on your device unless uninstalled. Cloud data (if synced) is retained until manually deleted. You may request deletion via email.</p>

      <h2>6. Your Consent</h2>
      <p>By using the app, you agree to this privacy policy.</p>

      <h2>7. Contact Us</h2>
      <p>📧 Email: cityjewellers.india@gmail.com</p>    </div>
  );
}
