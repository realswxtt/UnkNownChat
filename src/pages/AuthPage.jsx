import { useState } from 'react'
import { supabase } from '../supabase/client'
import Icon from '../components/Icon'

export default function AuthPage() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        // Append dummy domain if not present (allows username-only login)
        const email = username.includes('@') ? username : `${username}@aethel.com`

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { display_name: username }
                    }
                })
                if (error) throw error
                setSuccess('¡Cuenta creada! Ya puedes iniciar sesión.')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
            }
        } catch (e) {
            let msg = e.message
            if (msg.includes('Email not confirmed')) {
                msg = 'El usuario no está confirmado. Por favor, desactiva "Confirm email" en tu panel de Supabase (Auth > Providers > Email).'
            } else if (msg.includes('Invalid login credentials')) {
                msg = 'Usuario o contraseña incorrectos.'
            }
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const toggle = () => {
        setIsSignUp(!isSignUp)
        setError('')
        setSuccess('')
    }

    return (
        <div className="auth-page">
            <div className="auth-left">
                <div className="auth-left-content fadeIn">
                    <div className="aethel-logo-xl">
                        <img src="/logo.png" alt="Aethel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <h1>Aethel</h1>
                    <p>Tu espacio privado para conversaciones que importan. Seguro, simple y elegante.</p>
                </div>
            </div>
            <div className="auth-right">
                <div className="auth-card fadeIn">
                    <h2>{isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
                    <p className="sub">en Aethel</p>
                    <form onSubmit={submit} className="auth-form">
                        {error && <div className="alert-err">{error}</div>}
                        {success && <div className="alert-ok">{success}</div>}
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nombre de usuario"
                            required
                            autoFocus
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            required
                            minLength={6}
                        />
                        <button type="submit" className="btn-main" disabled={loading}>
                            {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Entrar'}
                        </button>
                    </form>
                    <div className="auth-divider"><span>o</span></div>
                    <button className="btn-secondary" onClick={toggle}>
                        {isSignUp ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
                    </button>
                </div>
            </div>
        </div>
    )
}
