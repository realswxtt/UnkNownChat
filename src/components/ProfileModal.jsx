import { useState, useRef } from 'react'
import Icon from './Icon'

export default function ProfileModal({ profile, onSave, onClose }) {
    const [name, setName] = useState(profile?.display_name || '')
    const [bio, setBio] = useState(profile?.bio || '')
    const [avatar, setAvatar] = useState(profile?.avatar_url || '')
    const [saving, setSaving] = useState(false)
    const fileRef = useRef(null)

    const pickFile = (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > 5242880) return alert('Máximo 5MB') // 5MB limit
        const r = new FileReader()
        r.onloadend = () => setAvatar(r.result)
        r.readAsDataURL(f)
    }

    const save = async () => {
        setSaving(true)
        await onSave({ display_name: name.trim(), bio: bio.trim(), avatar_url: avatar })
        setSaving(false)
        onClose()
    }

    return (
        <div className="modal-bg" onClick={onClose}>
            <div className="modal fadeIn" onClick={(e) => e.stopPropagation()}>
                <div className="modal-top">
                    <h3>Editar perfil</h3>
                    <button className="icon-btn" onClick={onClose}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className="modal-content">
                    <div className="avatar-edit" onClick={() => fileRef.current?.click()}>
                        {avatar ? (
                            <img src={avatar} alt="" />
                        ) : (
                            <span className="av-letter">{(name || '?').charAt(0).toUpperCase()}</span>
                        )}
                        <div className="avatar-hover">
                            <Icon name="camera" size={22} />
                        </div>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} hidden />
                    <p className="hint">Click en la foto para cambiar</p>
                    <div className="form-field">
                        <label>Nombre</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={30} />
                    </div>
                    <div className="form-field">
                        <label>Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Algo sobre ti..." rows={2} maxLength={120} />
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="btn-main btn-sm" onClick={save} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
