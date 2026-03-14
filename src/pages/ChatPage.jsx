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
import { useUnreadCount } from '../hooks/useUnreadCount'
import { useSpaces } from '../hooks/useSpaces'

export default function ChatPage() {
    const { session, signOut } = useAuth()
    const [receiverId, setReceiverId] = useState(null)
    const [activeSpace, setActiveSpace] = useState(null)
    const [newMsg, setNewMsg] = useState('')
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [showEditProfile, setShowEditProfile] = useState(false)
    const [showViewProfile, setShowViewProfile] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('chat')
    const [replyingTo, setReplyingTo] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [recordTime, setRecordTime] = useState(0)
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const timerRef = useRef(null)
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

    // Spaces
    const { spaces, createSpace, joinSpace } = useSpaces(session?.user?.id)

    // Unread
    const { totalUnread, unreadPerChat } = useUnreadCount(session?.user?.id)

    // Messages
    const { messages, sendMessage, deleteMessage, clearChat, uploadImage, sending, isTyping, sendTyping, markAsRead, reactMessage } = useMessages(session?.user?.id, receiverId)

    // Mark as read when messages load and receiver is set
    useEffect(() => {
        if (!session?.user?.id || !receiverId) return
        const unreadIds = messages
            .filter(m => m.receiver_id === session?.user?.id && m.sender_id === receiverId && !m.read_at)
            .map(m => m.id)
        if (unreadIds.length > 0) {
            markAsRead(unreadIds)
        }
    }, [messages, session?.user?.id, receiverId, markAsRead])

    // Auto-scroll
    const scroll = () => endRef.current?.scrollIntoView({ behavior: 'smooth' })
    useEffect(() => { scroll() }, [messages])

    // Image change
    const onFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('El archivo es demasiado grande. El límite es de 5MB.')
                e.target.value = ''
                return
            }
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
        }
    }

    const cancelImage = () => {
        setImageFile(null)
        setImagePreview(null)
        if (fileRef.current) fileRef.current.value = ''
    }

    // Voice Notes Logic
    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop()
            }
            clearInterval(timerRef.current)
            setIsRecording(false)
            setRecordTime(0)
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                const mediaRecorder = new MediaRecorder(stream)
                mediaRecorderRef.current = mediaRecorder
                audioChunksRef.current = []

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunksRef.current.push(e.data)
                }

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                    // Send audio message directly
                    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })
                    const audioUrl = await uploadImage(audioFile)
                    if (audioUrl) {
                        await sendMessage('', null, replyingTo?.id, audioUrl)
                        setReplyingTo(null)
                    }
                    // Release microphone
                    stream.getTracks().forEach(track => track.stop())
                }

                mediaRecorder.start()
                setIsRecording(true)
                setRecordTime(0)
                timerRef.current = setInterval(() => {
                    setRecordTime(prev => prev + 1)
                }, 1000)
            } catch (err) {
                console.error("No se pudo acceder al micrófono:", err)
                alert("Debes permitir el acceso al micrófono para enviar notas de voz.")
            }
        }
    }

    // Typing Event handling
    useEffect(() => {
        let typingTimeout
        if (newMsg.trim().length > 0) {
            sendTyping(true)
            typingTimeout = setTimeout(() => sendTyping(false), 2000)
        } else {
            sendTyping(false)
        }
        return () => clearTimeout(typingTimeout)
    }, [newMsg, sendTyping])


    // Send handler
    const handleSend = async (e) => {
        e.preventDefault()
        if (!newMsg.trim() && !imageFile) return

        let imgUrl = null
        if (imageFile) {
            imgUrl = await uploadImage(imageFile)
        }

        if (await sendMessage(newMsg, imgUrl, replyingTo?.id)) {
            setNewMsg('')
            cancelImage()
            setReplyingTo(null)
            inputRef.current?.focus()
        }
    }

    const scrollToReply = (id) => {
        const el = document.getElementById(`msg-${id}`)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('highlight-msg')
            setTimeout(() => el.classList.remove('highlight-msg'), 1000)
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
                    <button className="icon-btn btn-menu-mobile" onClick={() => setIsMenuOpen(true)}>
                        <Icon name="menu" size={24} />
                    </button>
                    <div className="topnav-brand">
                        <div className="brand-shield">
                            <img src="/logo.png" alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        </div>
                        <span>Aethel</span>
                    </div>
                </div>
                <div className="topnav-center">
                    <button className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setReceiverId(null); }} title="Inicio">
                        <Icon name="home" size={22} />
                    </button>
                    <button className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => { setActiveTab('people'); setReceiverId(null); }} title="Personas">
                        <Icon name="people" size={22} />
                    </button>
                    <button className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')} title="Chat">
                        <Icon name="chat" size={22} />
                        {totalUnread > 0 && <span className="nav-badge">{totalUnread}</span>}
                    </button>
                    <button className={`nav-tab ${activeTab === 'notif' ? 'active' : ''}`} onClick={() => { setActiveTab('notif'); setReceiverId(null); }} title="Notificaciones">
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
                                <span className="sb-sub" style={{ fontFamily: 'monospace' }}>ID: {myProfile?.short_id || '...'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="sb-divider" />

                    <div className="sb-section">
                        <h4 className="sb-title">Mis Cursos / Espacios</h4>
                        <div className="sb-item" onClick={() => {
                            const name = prompt("Nombre del nuevo curso/espacio:")
                            if (name) createSpace(name)
                        }}>
                            <div className="sb-icon"><Icon name="plus" size={18} /></div>
                            <span>Crear / Unirse a Curso</span>
                        </div>

                        {spaces.map(s => (
                            <div key={s.id} className={`sb-item ${activeSpace?.id === s.id ? 'active' : ''}`} onClick={() => { setActiveSpace(s); setReceiverId(null); setActiveTab('chat') }}>
                                <div className="sb-icon" style={{ borderRadius: '6px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}>
                                    <Icon name="people" size={18} />
                                </div>
                                <div className="sb-item-info">
                                    <span className="sb-name">{s.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="sb-divider" />

                    <div className="sb-section">
                        <h4 className="sb-title">Mensajes Directos</h4>
                        <div className="sb-item" onClick={() => { setReceiverId(null); setActiveSpace(null); setActiveTab('chat') }}>
                            <div className="sb-icon"><Icon name="plus" size={18} /></div>
                            <span>Nuevo mensaje</span>
                        </div>

                        {recentChats.map(id => (
                            <ContactItem key={id} id={id} active={receiverId === id && !activeSpace} onClick={() => { setReceiverId(id); setActiveSpace(null); setActiveTab('chat'); }} unreadCount={unreadPerChat[id] || 0} />
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
                            {!receiverId && !activeSpace && (
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

                            {/* Chat window or Space Window */}
                            {(receiverId || activeSpace) && (
                                <div className={`chat-window fadeIn ${activeSpace ? 'space-layout' : ''}`}>

                                    {/* ----- SPACE HEADER ----- */}
                                    {activeSpace && (
                                        <div className="cw-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                                <button className="icon-btn btn-back-mobile" onClick={() => setActiveSpace(null)}>
                                                    <Icon name="chevronLeft" size={24} />
                                                </button>
                                                <div className="sb-icon" style={{ borderRadius: '6px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', padding: '8px' }}>
                                                    <Icon name="people" size={20} />
                                                </div>
                                                <div className="cw-header-info">
                                                    <span className="cw-name">{activeSpace.name}</span>
                                                    <span className="cw-status" style={{ color: 'var(--text-3)' }}>
                                                        {isTyping ? 'Alguien está escribiendo...' : 'Curso / Grupo de Estudio'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button className="btn-main" style={{ padding: '6px 12px', fontSize: '13px' }}>
                                                    <Icon name="plus" size={14} style={{ marginRight: '4px' }} /> Miembros
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ----- DM HEADER ----- */}
                                    {receiverId && !activeSpace && (
                                        <div className="cw-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                                <button className="icon-btn btn-back-mobile" onClick={() => setReceiverId(null)}>
                                                    <Icon name="chevronLeft" size={24} />
                                                </button>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }} onClick={() => setShowViewProfile(true)} className="pointer">
                                                    <Avatar src={otherProfile?.avatar_url} name={otherProfile?.display_name} size={38} id={receiverId} online />
                                                    <div className="cw-header-info">
                                                        <span className="cw-name">{otherProfile?.display_name || 'Usuario'}</span>
                                                        <span className="cw-status">
                                                            {isTyping ? 'escribiendo...' : 'En línea'}
                                                        </span>
                                                    </div>
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
                                    )}

                                    <div className="cw-messages">
                                        {messages.length === 0 && (
                                            <div className="cw-empty">
                                                <Icon name={activeSpace ? "people" : "userPlus"} size={48} style={{ opacity: 0.5, marginBottom: '10px' }} />
                                                <p>
                                                    {activeSpace
                                                        ? `Bienvenido a ${activeSpace.name}`
                                                        : `Conversación privada con ${otherProfile?.display_name || 'Usuario'}`}
                                                </p>
                                                <span>{activeSpace ? 'Envía el primer mensaje para empezar el debate académico.' : 'Los mensajes son solo entre ustedes dos.'}</span>
                                            </div>
                                        )}
                                        {messages.map((m) => {
                                            const mine = m.sender_id === session?.user?.id
                                            const dl = getDateLabel(m.created_at)
                                            let showD = false
                                            if (dl !== lastD) { showD = true; lastD = dl }
                                            return (
                                                <MessageItem key={m.id} m={m} mine={mine} dl={dl} showD={showD}
                                                    otherProfile={otherProfile} receiverId={receiverId}
                                                    session={session} formatTime={formatTime}
                                                    deleteMessage={deleteMessage} messages={messages}
                                                    scrollToReply={scrollToReply} onReply={setReplyingTo} reactMessage={reactMessage} />
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

                                    {/* Replying To Banner */}
                                    {replyingTo && (
                                        <div className="reply-banner fadeIn">
                                            <div className="reply-banner-content">
                                                <span className="rep-name">{replyingTo.sender_id === session?.user?.id ? 'Tú' : (otherProfile?.display_name || 'Usuario')}</span>
                                                <p>{replyingTo.content || (replyingTo.image_url ? '📷 Foto' : 'Mensaje')}</p>
                                            </div>
                                            <button onClick={() => setReplyingTo(null)} className="icon-btn-plain"><Icon name="x" size={16} /></button>
                                        </div>
                                    )}

                                    <form onSubmit={handleSend} className="cw-input">
                                        <input type="file" ref={fileRef} hidden accept="image/*" onChange={onFileChange} />
                                        <button type="button" className="icon-btn-plain" onClick={() => fileRef.current?.click()} style={{ display: isRecording ? 'none' : 'block' }}>
                                            <Icon name="image" size={22} />
                                        </button>

                                        {!isRecording ? (
                                            <input
                                                ref={inputRef}
                                                value={newMsg}
                                                onChange={(e) => setNewMsg(e.target.value)}
                                                placeholder={imageFile ? "Añadir comentario..." : `Escribe a ${otherProfile?.display_name || 'Usuario'}...`}
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="recording-bar fadeIn">
                                                <div className="recording-pulse"></div>
                                                <span className="recording-time">Grabando... {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}</span>
                                            </div>
                                        )}

                                        {!newMsg.trim() && !imageFile ? (
                                            <button type="button" onClick={toggleRecording} className={`send-circle ${isRecording ? 'recording' : ''}`} title="Nota de voz">
                                                <Icon name={isRecording ? 'x' : 'mic'} size={18} />
                                            </button>
                                        ) : (
                                            <button type="submit" disabled={sending} className="send-circle">
                                                {sending ? <div className="spinner-xs" /> : <Icon name="send" size={18} />}
                                            </button>
                                        )}
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
                        <ContactItem key={id} id={id} active={receiverId === id && !activeSpace} onClick={() => { setReceiverId(id); setActiveSpace(null); setActiveTab('chat'); }} unreadCount={unreadPerChat[id] || 0} />
                    ))}
                </aside>
            </div>

            {/* MOBILE DRAWER */}
            {
                isMenuOpen && (
                    <div className="drawer-overlay" onClick={() => setIsMenuOpen(false)}>
                        <div className="drawer-content fadeInRight" onClick={e => e.stopPropagation()}>
                            <div className="drawer-header">
                                <Avatar src={myProfile?.avatar_url} name={myProfile?.display_name} size={60} id={session?.user?.id} />
                                <div className="drawer-user-info">
                                    <h3>{myProfile?.display_name || 'Nombre'}</h3>
                                    <span className="sub">ID: {myProfile?.short_id}</span>
                                </div>
                                <button className="icon-btn" onClick={() => setIsMenuOpen(false)}>
                                    <Icon name="x" size={20} />
                                </button>
                            </div>
                            <div className="drawer-body">
                                <div className="drawer-item" onClick={() => { setShowEditProfile(true); setIsMenuOpen(false); }}>
                                    <Icon name="settings" size={22} />
                                    <span>Configuración de Perfil</span>
                                </div>
                                <div className="drawer-item" onClick={() => { setActiveTab('home'); setIsMenuOpen(false); setReceiverId(null); }}>
                                    <Icon name="home" size={22} />
                                    <span>Ir al Inicio</span>
                                </div>
                                <div className="drawer-divider" />
                                <div className="drawer-item text-red" onClick={handleSignOut}>
                                    <Icon name="logout" size={22} />
                                    <span>Cerrar sesión</span>
                                </div>
                            </div>
                            <div className="drawer-footer">
                                <p className="hint">Aethel v1.0.0 — Privacidad Total</p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODALS */}
            {
                showEditProfile && (
                    <ProfileModal
                        profile={myProfile}
                        onSave={saveProfile}
                        onClose={() => setShowEditProfile(false)}
                    />
                )
            }
            {
                showViewProfile && (
                    <ViewProfileModal
                        profile={otherProfile}
                        onClose={() => setShowViewProfile(false)}
                    />
                )
            }
        </div >
    )
}

function ContactItem({ id, onClick, active, unreadCount }) {
    const { profile } = useProfile(id)
    return (
        <div className={`sb-item ${active ? 'active' : ''}`} onClick={onClick}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={34} id={id} />
            <div className="sb-item-info">
                <span className="sb-name">{profile?.display_name || 'Usuario'}</span>
                {unreadCount > 0 ? (
                    <span className="badge-side">{unreadCount}</span>
                ) : (
                    <span className="sb-status-dot online" />
                )}
            </div>
        </div>
    )
}

function MessageItem({ m, mine, dl, showD, otherProfile, receiverId, session, formatTime, deleteMessage, messages, scrollToReply, onReply, reactMessage }) {
    const [swipeOffset, setSwipeOffset] = useState(0)
    const [showReactions, setShowReactions] = useState(false)
    const touchStartRef = useRef(null)

    const handleReaction = (emoji) => {
        reactMessage(m.id, emoji, m.reactions || {})
        setShowReactions(false)
    }

    const EMOJIS = ['❤️', '👍', '😂', '😢', '🔥', '👀']

    const onTouchStart = (e) => {
        touchStartRef.current = e.touches[0].clientX
    }

    const onTouchMove = (e) => {
        if (touchStartRef.current === null) return
        const x = e.touches[0].clientX
        const diff = x - touchStartRef.current

        // Swipe right
        if (diff > 0 && diff < 80) {
            setSwipeOffset(diff)
        }
    }

    const onTouchEnd = () => {
        if (swipeOffset > 50) {
            onReply(m)
            if (window.navigator?.vibrate) window.navigator.vibrate(50)
        }
        setSwipeOffset(0)
        touchStartRef.current = null
    }

    const repliedMsg = m.reply_to ? messages.find(msg => msg.id === m.reply_to) : null

    return (
        <div id={`msg-${m.id}`} className="msg-container">
            {showD && <div className="date-sep"><span>{dl}</span></div>}
            <div className={`msg-wrapper ${mine ? 'mw-out' : 'mw-in'}`}>
                <div className="swipe-reply-icon" style={{ opacity: swipeOffset / 50, transform: `scale(${Math.min(swipeOffset / 50, 1)})` }}>
                    <Icon name="reply" size={16} />
                </div>
                <div className={`msg ${mine ? 'msg-out' : 'msg-in'}`}
                    style={{ transform: `translateX(${swipeOffset}px)`, transition: touchStartRef.current !== null ? 'none' : 'transform 0.2s' }}
                    onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
                    onDoubleClick={() => setShowReactions(!showReactions)}
                >
                    {!mine && <Avatar src={otherProfile?.avatar_url} name={otherProfile?.display_name} size={30} id={receiverId} />}
                    <div className={`bubble ${mine ? 'b-out' : 'b-in'} ${showReactions ? 'active' : ''}`}>
                        {repliedMsg && (
                            <div className="rep-bubble pointer" onClick={() => scrollToReply(repliedMsg.id)}>
                                <span className="rep-name">{repliedMsg.sender_id === session?.user?.id ? 'Tú' : (otherProfile?.display_name || 'Usuario')}</span>
                                <p>{repliedMsg.content || (repliedMsg.image_url ? '📷 Foto' : 'Mensaje')}</p>
                            </div>
                        )}
                        {m.image_url && <img src={m.image_url} alt="Shared" className="msg-img" />}
                        {m.audio_url && (
                            <div className="audio-player">
                                <audio controls src={m.audio_url} />
                            </div>
                        )}
                        {m.content && <p>{m.content}</p>}
                        <div className="msg-meta">
                            <time>{formatTime(m.created_at)}</time>
                            {mine && (
                                <span className={`read-receipt ${m.read_at ? 'read' : 'sent'}`}>
                                    {m.read_at ? '✔✔' : '✔'}
                                </span>
                            )}
                        </div>
                    </div>

                    {showReactions && (
                        <div className="reaction-picker fadeIn">
                            {EMOJIS.map(emoji => (
                                <span key={emoji} onClick={() => handleReaction(emoji)} className="emoji-btn">{emoji}</span>
                            ))}
                        </div>
                    )}

                    {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="reaction-badges" onClick={() => setShowReactions(!showReactions)}>
                            {Array.from(new Set(Object.values(m.reactions))).map(r => (
                                <span key={r}>{r}</span>
                            ))}
                            <span className="reaction-count">{Object.keys(m.reactions).length > 1 ? Object.keys(m.reactions).length : ''}</span>
                        </div>
                    )}

                    {mine && (
                        <div className="msg-actions">
                            <button className="msg-action-btn" onClick={() => setShowReactions(!showReactions)} title="Reaccionar">
                                <Icon name="smile" size={14} />
                            </button>
                            <button className="msg-action-btn" onClick={() => onReply(m)} title="Responder">
                                <Icon name="reply" size={14} />
                            </button>
                            <button className="msg-action-btn text-red" onClick={() => deleteMessage(m.id)} title="Eliminar">
                                <Icon name="trash" size={14} />
                            </button>
                        </div>
                    )}
                    {!mine && (
                        <div className="msg-actions">
                            <button className="msg-action-btn" onClick={() => setShowReactions(!showReactions)} title="Reaccionar">
                                <Icon name="smile" size={14} />
                            </button>
                            <button className="msg-action-btn" onClick={() => onReply(m)} title="Responder">
                                <Icon name="reply" size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
