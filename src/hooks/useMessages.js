import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useMessages(userId, receiverId) {
    const [messages, setMessages] = useState([])
    const [sending, setSending] = useState(false)

    // Fetch history
    useEffect(() => {
        if (!userId || !receiverId) return
        supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true })
            .then(({ data }) => { if (data) setMessages(data) })
    }, [userId, receiverId])

    // Realtime subscription
    useEffect(() => {
        if (!userId || !receiverId) return
        const ch = supabase
            .channel(`rt-${userId}-${receiverId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const msg = payload.new
                if (
                    (msg.sender_id === userId && msg.receiver_id === receiverId) ||
                    (msg.sender_id === receiverId && msg.receiver_id === userId)
                ) {
                    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
                }
            })
            .subscribe()
        return () => ch.unsubscribe()
    }, [userId, receiverId])

    // Send message
    const sendMessage = async (content, imageUrl = null, replyTo = null) => {
        if ((!content.trim() && !imageUrl) || !receiverId || sending) return false
        setSending(true)
        const { error } = await supabase.from('messages').insert({
            sender_id: userId,
            receiver_id: receiverId,
            content: content.trim(),
            image_url: imageUrl,
            reply_to: replyTo
        })
        setSending(false)
        return !error
    }

    // Delete message
    const deleteMessage = async (messageId) => {
        const { error } = await supabase.from('messages').delete().eq('id', messageId)
        if (!error) {
            setMessages((prev) => prev.filter((m) => m.id !== messageId))
        }
        return !error
    }

    // Clear chat
    const clearChat = async () => {
        if (!userId || !receiverId) return false
        const { error } = await supabase
            .from('messages')
            .delete()
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`)

        if (!error) {
            setMessages([])
        }
        return !error
    }

    // Upload image to storage
    const uploadImage = async (file) => {
        if (!file) return null
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${userId}/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, file)

        if (uploadError) return null

        const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath)
        return data.publicUrl
    }

    return { messages, sendMessage, deleteMessage, clearChat, uploadImage, sending }
}
