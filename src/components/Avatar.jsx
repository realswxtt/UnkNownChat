import { hashColor } from '../lib/helpers'

export default function Avatar({ src, name, size = 40, id = '', online }) {
    const initial = (name || '?').charAt(0).toUpperCase()
    const bg = hashColor(id || name)

    return (
        <div className="av" style={{ width: size, height: size, position: 'relative' }}>
            {src ? (
                <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
                <div className="av-init" style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
                    {initial}
                </div>
            )}
            {online && <span className="av-online" />}
        </div>
    )
}
