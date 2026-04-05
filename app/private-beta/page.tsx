export default function PrivateBetaPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#ffffff' }}>
        RevisionGrade
      </h1>
      <div style={{
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #333',
        backgroundColor: '#111',
        maxWidth: '480px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#f0f0f0' }}>
          Private Beta
        </h2>
        <p style={{ lineHeight: 1.6, color: '#999' }}>
          RevisionGrade is currently in private beta and not accepting new users.
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          If you have an account, access has been restricted. Contact the administrator for questions.
        </p>
      </div>
    </div>
  )
}
