import { AVATAR_COLORS } from './constants'

export function hashColor(id) {
    if (!id) return AVATAR_COLORS[0]
    let h = 0
    for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getDateLabel(iso) {
    const d = new Date(iso)
    const t = new Date()
    if (d.toDateString() === t.toDateString()) return 'Hoy'
    const y = new Date(t)
    y.setDate(t.getDate() - 1)
    if (d.toDateString() === y.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
