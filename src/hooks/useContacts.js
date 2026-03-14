import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useContacts(userId) {
    const [recentChats, setRecentChats] = useState([])
    const [savedContacts, setSavedContacts] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchAll = async () => {
        if (!userId) return
        setLoading(true)

        // 1. Get recent unique IDs from messages
        const { data: msgs } = await supabase
            .from('messages')
            .select('sender_id, receiver_id, created_at')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false })

        const uniqueIds = new Set()
        if (msgs) {
            msgs.forEach(m => {
                if (m.sender_id !== userId) uniqueIds.add(m.sender_id)
                if (m.receiver_id !== userId) uniqueIds.add(m.receiver_id)
            })
        }
        setRecentChats(Array.from(uniqueIds).slice(0, 10))

        // 2. Get saved contacts
        const { data: contacts } = await supabase
            .from('contacts')
            .select('contact_id')
            .eq('user_id', userId)

        if (contacts) {
            setSavedContacts(contacts.map(c => c.contact_id))
        }

        setLoading(false)
    }

    useEffect(() => {
        fetchAll()
    }, [userId])

    const saveContact = async (contactId) => {
        if (!userId || !contactId) return
        const { error } = await supabase
            .from('contacts')
            .insert({ user_id: userId, contact_id: contactId })
            .select()

        if (!error) {
            setSavedContacts(prev => [...prev, contactId])
        }
        return !error
    }

    const removeContact = async (contactId) => {
        if (!userId || !contactId) return
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('user_id', userId)
            .eq('contact_id', contactId)

        if (!error) {
            setSavedContacts(prev => prev.filter(id => id !== contactId))
        }
        return !error
    }

    return { recentChats, savedContacts, loading, saveContact, removeContact, reload: fetchAll }
}
