import Avatar from './Avatar'
import Icon from './Icon'

export default function ViewProfileModal({ profile, onClose }) {
    if (!profile) return null

    return (
        <div className="modal-bg" onClick={onClose}>
            <div className="modal modal-narrow fadeIn" onClick={(e) => e.stopPropagation()}>
                <div className="modal-top">
                    <h3>Perfil</h3>
                    <button className="icon-btn" onClick={onClose}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className="view-profile">
                    <Avatar src={profile.avatar_url} name={profile.display_name} size={90} id={profile.id} />
                    <h2>{profile.display_name || 'Sin nombre'}</h2>
                    {profile.bio && <p className="bio">{profile.bio}</p>}
                    <span className="uid">{profile.id}</span>
                </div>
            </div>
        </div>
    )
}
