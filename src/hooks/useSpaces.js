import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useSpaces(userId) {
    const [spaces, setSpaces] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchSpaces = async () => {
        if (!userId) return
        setLoading(true)

        // Get spaces where the user is a member
        const { data, error } = await supabase
            .from('spaces')
            .select(`
                id, name, description, avatar_url,
                space_members!inner(user_id)
            `)
            .eq('space_members.user_id', userId)
            .order('created_at', { ascending: false })

        if (!error && data) {
            setSpaces(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchSpaces()
    }, [userId])

    const createSpace = async (name, description = '') => {
        if (!userId || !name.trim()) return null

        // 1. Create the space
        const { data: spaceData, error: spaceError } = await supabase
            .from('spaces')
            .insert({ name: name.trim(), description, created_by: userId })
            .select()
            .single()

        if (spaceError) {
            console.error("Error creating space:", spaceError)
            return null
        }

        // 2. Add creator as member
        const { error: memberError } = await supabase
            .from('space_members')
            .insert({ space_id: spaceData.id, user_id: userId, role: 'admin' })

        if (memberError) {
            console.error("Error adding creator to space:", memberError)
        }

        fetchSpaces()
        return spaceData
    }

    const joinSpace = async (spaceId) => {
        if (!userId || !spaceId) return false

        const { error } = await supabase
            .from('space_members')
            .insert({ space_id: spaceId, user_id: userId })

        if (!error) fetchSpaces()
        return !error
    }

    const leaveSpace = async (spaceId) => {
        if (!userId || !spaceId) return false

        const { error } = await supabase
            .from('space_members')
            .delete()
            .eq('space_id', spaceId)
            .eq('user_id', userId)

        if (!error) fetchSpaces()
        return !error
    }

    return { spaces, loading, createSpace, joinSpace, leaveSpace, reload: fetchSpaces }
}
