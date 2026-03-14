import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'

const generateShortId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = ''
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

export function useProfile(userId) {
    const [profile, setProfile] = useState(null)

    const loadProfile = useCallback(async (userMetadata) => {
        if (!userId) return

        let { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

        if (data) {
            // If profile exists but short_id is missing, generate it
            if (!data.short_id) {
                const sid = generateShortId()
                const { data: updated } = await supabase
                    .from('profiles')
                    .update({ short_id: sid })
                    .eq('id', userId)
                    .select()
                    .single()
                if (updated) data = updated
            }
            setProfile(data)
        } else {
            // New profile initialization
            const sid = generateShortId()
            const fallback = {
                id: userId,
                display_name: userMetadata?.display_name || userId.slice(0, 8),
                avatar_url: '',
                bio: '',
                short_id: sid
            }
            // Try to create the profile record to persist the short_id
            await supabase.from('profiles').upsert({ id: userId, short_id: sid, display_name: fallback.display_name })
            setProfile(fallback)
        }
    }, [userId])

    useEffect(() => { loadProfile() }, [loadProfile])

    const updateProfile = async (updates) => {
        await supabase.from('profiles').upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
        setProfile((prev) => ({ ...prev, ...updates }))
    }

    return { profile, updateProfile, reloadProfile: loadProfile }
}
