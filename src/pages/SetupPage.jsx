import Icon from '../components/Icon'

export default function SetupPage() {
    return (
        <div className="center-page">
            <div className="setup-card fadeIn">
                <div className="aethel-logo-lg">
                    <img src="/logo.png" alt="Aethel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(45,136,255,0.15))' }} />
                </div>
                <h1 className="brand-text">Aethel</h1>
                <p className="sub">Conecta tu proyecto de Supabase para comenzar.</p>
                <div className="setup-body">
                    <div className="step-row">
                        <span className="step-n">1</span>Edita <code>.env</code> con tus credenciales
                    </div>
                    <pre className="code-pre">
                        VITE_SUPABASE_URL=https://xxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=eyJhbG...
                    </pre>
                    <div className="step-row">
                        <span className="step-n">2</span>Reinicia con <code>npm run dev</code>
                    </div>
                </div>
                <p className="hint">Credenciales en: Supabase → Settings → API</p>
            </div>
        </div>
    )
}
