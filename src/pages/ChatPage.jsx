import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useMessages } from '../hooks/useMessages'
import { formatTime, getDateLabel } from '../lib/helpers'

import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import ProfileModal from '../components/ProfileModal'
import ViewProfileModal from '../components/ViewProfileModal'
import { useContacts } from '../hooks/useContacts'

export default function ChatPage() {
    const { session, signOut } = useAuth()
    const [receiverId, setReceiverId] = useState(null)
    const [newMsg, setNewMsg] = useState('')
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [showEditProfile, setShowEditProfile] = useState(false)
    const [showViewProfile, setShowViewProfile] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [activeTab, setActiveTab] = useState('chat')
    const endRef = useRef(null)
    const inputRef = useRef(null)
    const fileRef = useRef(null)

    // Profiles
    const { profile: myProfile, updateProfile: saveProfile, reloadProfile } = useProfile(session?.user?.id)
    const { profile: otherProfile } = useProfile(receiverId)

    useEffect(() => {
        if (session?.user?.id) {
            reloadProfile(session.user.user_metadata)
        }
    }, [session, reloadProfile])

    // Contacts & Recent
    const { recentChats, savedContacts, saveContact, removeContact } = useContacts(session?.user?.id)

    // Messages
    const { messages, sendMessage, deleteMessage, clearChat, uploadImage, sending } = useMessages(session?.user?.id, receiverId)

    // Auto-scroll
    const scroll = () => endRef.current?.scrollIntoView({ behavior: 'smooth' })
    useEffect(() => { scroll() }, [messages])

    // Image change
    const onFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
        }
    }

    const cancelImage = () => {
        setImageFile(null)
        setImagePreview(null)
        if (fileRef.current) fileRef.current.value = ''
    }

    // Send handler
    const handleSend = async (e) => {
        e.preventDefault()
        if (!newMsg.trim() && !imageFile) return

        let imgUrl = null
        if (imageFile) {
            imgUrl = await uploadImage(imageFile)
        }

        if (await sendMessage(newMsg, imgUrl)) {
            setNewMsg('')
            cancelImage()
            inputRef.current?.focus()
        }
    }

    // Management handlers
    const handleClear = async () => {
        if (confirm('¿Vaciar toda la conversación?')) {
            await clearChat()
            setShowMenu(false)
        }
    }

    const handleDeleteChat = async () => {
        if (confirm('¿Eliminar este chat por completo?')) {
            await clearChat()
            setReceiverId(null)
            setShowMenu(false)
        }
    }

    // Contact toggle
    const isSaved = savedContacts.includes(receiverId)
    const toggleContact = async () => {
        if (isSaved) {
            await removeContact(receiverId)
        } else {
            await saveContact(receiverId)
        }
    }

    // Connect handler
    const connectUser = async (e) => {
        e.preventDefault()
        const val = e.target.rid.value.trim()
        if (!val) return

        // Search for user by short_id (5 chars) or full UUID
        let targetId = val
        if (val.length === 5) {
            const { data } = await supabase.from('profiles').select('id').eq('short_id', val.toUpperCase()).single()
            if (data) targetId = data.id
            else {
                alert('No se encontró ningún usuario con ese ID de 5 dígitos.')
                return
            }
        }

        setReceiverId(targetId)
        setActiveTab('chat')
        e.target.reset()
    }

    // Sign out handler
    const handleSignOut = async () => {
        await signOut()
    }

    // Helper for short ID (obsolete for connection but kept for sytle if needed)
    const shortId = (id) => id ? `${id.slice(0, 8)}...` : ''

    let lastD = ''

    return (
        <div className="fb-layout">
            {/* ── TOP NAVBAR ── */}
            <nav className="topnav">
                <div className="topnav-left">
                    <div className="topnav-brand">
                        <div className="brand-shield">
                            <img src="/logo.png" alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        </div>
                        <span>Aethel</span>
                    </div>
                </div>
                <div className="topnav-center">
                    <button className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} title="Inicio">
                        <Icon name="home" size={22} />
                    </button>
                    <button className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')} title="Personas">
                        <Icon name="people" size={22} />
                    </button>
                    <button className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')} title="Chat">
                        <Icon name="chat" size={22} />
                    </button>
                    <button className={`nav-tab ${activeTab === 'notif' ? 'active' : ''}`} onClick={() => setActiveTab('notif')} title="Notificaciones">
                        <Icon name="bell" size={22} />
                    </button>
                </div>
                <div className="topnav-right">
                    <button className="icon-btn" onClick={() => setShowEditProfile(true)} title="Configuración">
                        <Icon name="settings" size={20} />
                    </button>
                    <div className="topnav-me" onClick={() => setShowEditProfile(true)}>
                        <Avatar src={myProfile?.avatar_url} name={myProfile?.display_name} size={32} id={session?.user?.id} />
                    </div>
                </div>
            </nav>

            {/* ── BODY ── */}
            <div className="fb-body">
                {/* LEFT SIDEBAR */}
                <aside className="sidebar-left">
                    <div className="sb-section">
                        <div className="sb-item" onClick={() => setShowEditProfile(true)}>
                            <Avatar src={myProfile?.avatar_url} name={myProfile?.display_name} size={34} id={session?.user?.id} />
                            <div className="sb-item-info">
                                <span className="sb-name">{myProfile?.display_name || 'Mi perfil'}</span>
                                <span className="sb-sub">ID: {myProfile?.short_id || '...'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="sb-divider" />

                    <div className="sb-section">
                        <h4 className="sb-title">Mensajes</h4>
                        <div className="sb-item" onClick={() => { setReceiverId(null); setActiveTab('chat') }}>
                            <div className="sb-icon"><Icon name="plus" size={18} /></div>
                            <span>Nueva conversación</span>
                        </div>

                        {recentChats.map(id => (
                            <ContactItem key={id} id={id} active={receiverId === id} onClick={() => { setReceiverId(id); setActiveTab('chat'); }} />
                        ))}
                    </div>

                    <div className="sb-divider" />

                    <div className="sb-item sb-danger" onClick={handleSignOut}>
                        <div className="sb-icon"><Icon name="logout" size={20} /></div>
                        <span>Cerrar sesión</span>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="content-main">
                    {/* ── HOME VIEW ── */}
                    {activeTab === 'home' && (
                        <div className="home-view fadeIn">
                            <div className="card-feed">
                                <div className="card-feed-header">
                                    <h3>🏠 Bienvenidos a Aethel</h3>
                                </div>
                                <div className="card-feed-body">
                                    <div className="welcome-banner">
                                        <h4>Hola, {myProfile?.display_name || 'Usuario'}</h4>
                                        <p>Este es tu panel principal. Desde aquí puedes ver un resumen de tu actividad y conectar con otros de forma segura.</p>
                                    </div>
                                    <div className="home-grid">
                                        <div className="home-stat-card" onClick={() => setActiveTab('chat')} style={{ cursor: 'pointer' }}>
                                            <Icon name="chat" size={24} />
                                            <span>{recentChats.length} Chats activos</span>
                                        </div>
                                        <div className="home-stat-card">
                                            <Icon name="people" size={24} />
                                            <span>{savedContacts.length} Contactos guardados</span>
                                        </div>
                                    </div>
                                    <div className="my-info-card">
                                        <h5>Tu Identidad Aethel (Corto)</h5>
                                        <p className="sub">Comparte este ID de 5 dígitos con otros para que puedan contactarte de forma privada.</p>
                                        <div className="id-box">
                                            <code style={{ fontSize: '24px', letterSpacing: '4px' }}>{myProfile?.short_id || 'Generando...'}</code>
                                            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(myProfile?.short_id)}>
                                                Copiar ID
                                            </button>
                                        </div>
                                        <p className="sub" style={{ marginTop: '10px', fontSize: '11px' }}>ID Técnico (UUID): {session?.user?.id}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PEOPLE VIEW (Discovery) ── */}
                    {activeTab === 'people' && (
                        <div className="people-view fadeIn">
                            <div className="card-feed">
                                <div className="card-feed-header">
                                    <h3>👥 Descubrir Personas</h3>
                                </div>
                                <div className="card-feed-body">
                                    <p className="sub">Conéctate con otros usuarios ingresando su Identificador único de 5 dígitos.</p>
                                    <div className="discovery-actions">
                                        <button className="btn-main" onClick={() => { setActiveTab('chat'); setReceiverId(null); }}>
                                            <Icon name="plus" size={18} /> Nueva conversación
                                        </button>
                                    </div>
                                    <div className="discovery-info">
                                        <Icon name="shield" size={40} />
                                        <p>La privacidad es nuestra prioridad. Solo puedes conectar con personas si conoces su ID corto de 5 dígitos.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── CHAT VIEW ── */}
                    {activeTab === 'chat' && (
                        <>
                            {/* Connect screen */}
                            {!receiverId && (
                                <div className="card-feed fadeIn">
                                    <div className="card-feed-header"><h3>💬 Nueva conversación</h3></div>
                                    <div className="card-feed-body connect-body">
                                        <p className="sub">Ingresa el ID corto (5 dígitos) para iniciar un chat privado.</p>
                                        <form onSubmit={connectUser} className="connect-row">
                                            <input name="rid" type="text" placeholder="Ej: A7B9X" maxLength={36} autoFocus />
                                            <button type="submit" className="btn-main">Conectar</button>
                                        </form>
                                        <div className="my-uuid-mini">
                                            <span>Tu ID:</span> <strong>{myProfile?.short_id}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Chat window */}
                            {receiverId && (
                                <div className="chat-window fadeIn">
                                    <div className="cw-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }} onClick={() => setShowViewProfile(true)}>
                                            <Avatar src={otherProfile?.avatar_url} name={otherProfile?.display_name} size={38} id={receiverId} online />
                                            <div className="cw-header-info">
                                                <span className="cw-name">{otherProfile?.display_name || 'Usuario'}</span>
                                                <span className="cw-status">En línea</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button className={`icon-btn ${isSaved ? 'text-primary' : ''}`} onClick={toggleContact} title={isSaved ? 'Quitar contacto' : 'Guardar contacto'}>
                                                <Icon name={isSaved ? 'check' : 'userPlus'} size={20} />
                                            </button>
                                            <div style={{ position: 'relative' }}>
                                                <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
                                                    <Icon name="dots" size={18} />
                                                </button>
                                                {showMenu && (
                                                    <div className="dropdown-menu fadeIn">
                                                        <button onClick={handleClear}><Icon name="trash" size={16} /> Vaciar chat</button>
                                                        <button onClick={handleDeleteChat} className="text-red"><Icon name="x" size={16} /> Eliminar chat</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="cw-messages">
                                        {messages.length === 0 && (
                                            <div className="cw-empty">
                                                <img src="/logo.png" alt="" style={{ width: '64px', height: '64px', opacity: 0.5, marginBottom: '10px' }} />
                                                <p>Conversación privada con <strong>{otherProfile?.display_name || 'Usuario'}</strong></p>
                                                <span>Los mensajes son solo entre ustedes dos.</span>
                                            </div>
                                        )}
                                        {messages.map((m) => {
                                            const mine = m.sender_id === session?.user?.id
                                            const dl = getDateLabel(m.created_at)
                                            let showD = false
                                            if (dl !== lastD) { showD = true; lastD = dl }
                                            return (
                                                <div key={m.id} className="msg-container">
                                                    {showD && <div className="date-sep"><span>{dl}</span></div>}
                                                    <div className={`msg ${mine ? 'msg-out' : 'msg-in'}`}>
                                                        {!mine && <Avatar src={otherProfile?.avatar_url} name={otherProfile?.display_name} size={30} id={receiverId} />}
                                                        <div className={`bubble ${mine ? 'b-out' : 'b-in'}`}>
                                                            {m.image_url && <img src={m.image_url} alt="Shared" className="msg-img" />}
                                                            {m.content && <p>{m.content}</p>}
                                                            <time>{formatTime(m.created_at)}</time>
                                                        </div>
                                                        {mine && (
                                                            <button className="msg-action-del" onClick={() => deleteMessage(m.id)}>
                                                                <Icon name="trash" size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <div ref={endRef} />
                                    </div>

                                    {/* Image Preview */}
                                    {imagePreview && (
                                        <div className="img-preview-bar fadeIn">
                                            <img src={imagePreview} alt="Preview" />
                                            <button onClick={cancelImage} className="preview-close"><Icon name="x" size={14} /></button>
                                        </div>
                                    )}

                                    <form onSubmit={handleSend} className="cw-input">
                                        <input type="file" ref={fileRef} hidden accept="image/*" onChange={onFileChange} />
                                        <button type="button" className="icon-btn-plain" onClick={() => fileRef.current?.click()}>
                                            <Icon name="image" size={22} />
                                        </button>
                                        <input
                                            ref={inputRef}
                                            value={newMsg}
                                            onChange={(e) => setNewMsg(e.target.value)}
                                            placeholder={imageFile ? "Añadir comentario..." : `Escribe a ${otherProfile?.display_name || 'Usuario'}...`}
                                            autoFocus
                                        />
                                        <button type="submit" disabled={(!newMsg.trim() && !imageFile) || sending} className="send-circle">
                                            {sending ? <div className="spinner-xs" /> : <Icon name="send" size={18} />}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── NOTIFICATIONS VIEW ── */}
                    {activeTab === 'notif' && (
                        <div className="notif-view fadeIn">
                            <div className="card-feed">
                                <div className="card-feed-header">
                                    <h3>🔔 Notificaciones</h3>
                                </div>
                                <div className="card-feed-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <Icon name="bell" size={48} />
                                    <p className="sub" style={{ marginTop: '10px' }}>No tienes notificaciones pendientes.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* RIGHT SIDEBAR */}
                <aside className="sidebar-right">
                    <h4 className="sb-title">Contactos Guardados</h4>
                    {savedContacts.length === 0 && <p className="sub text-sm" style={{ padding: '0 12px' }}>Aún no has guardado contactos.</p>}
                    {savedContacts.map(id => (
                        <ContactItem key={id} id={id} active={receiverId === id} onClick={() => { setReceiverId(id); setActiveTab('chat'); }} />
                    ))}
                </aside>
            </div>

            {/* MODALS */}
            {showEditProfile && (
                <ProfileModal
                    profile={myProfile}
                    onSave={saveProfile}
                    onClose={() => setShowEditProfile(false)}
                />
            )}
            {showViewProfile && (
                <ViewProfileModal
                    profile={otherProfile}
                    onClose={() => setShowViewProfile(false)}
                />
            )}
        </div>
    )
}

function ContactItem({ id, onClick, active }) {
    const { profile } = useProfile(id)
    return (
        <div className={`sb-item ${active ? 'active' : ''}`} onClick={onClick}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={34} id={id} />
            <div className="sb-item-info">
                <span className="sb-name">{profile?.display_name || 'Usuario'}</span>
                <span className="sb-status-dot online" />
            </div>
        </div>
    )
}
