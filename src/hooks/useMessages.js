import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useMessages(userId, receiverId) {
    const [messages, setMessages] = useState([])
    const [sending, setSending] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const channelRef = useRef(null)

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

        setIsTyping(false) // Reset on user switch

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
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
                const msg = payload.new
                setMessages((prev) => {
                    const exists = prev.find(m => m.id === msg.id)
                    if (!exists) return prev
                    return prev.map((m) => m.id === msg.id ? { ...m, ...msg } : m)
                })
            })
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.userId === receiverId) {
                    setIsTyping(payload.payload.isTyping)
                }
            })
            .subscribe()

        channelRef.current = ch

        return () => {
            channelRef.current = null
            ch.unsubscribe()
        }
    }, [userId, receiverId])

    // Typing Event
    const sendTyping = (typing) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId, isTyping: typing }
            })
        }
    }

    // Send message
    const sendMessage = async (content, imageUrl = null, replyTo = null, audioUrl = null) => {
        if ((!content.trim() && !imageUrl && !audioUrl) || !receiverId || sending) return false
        setSending(true)
        const { error } = await supabase.from('messages').insert({
            sender_id: userId,
            receiver_id: receiverId,
            content: content.trim(),
            image_url: imageUrl,
            reply_to: replyTo,
            audio_url: audioUrl
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

    // Mark as read
    const markAsRead = async (messageIds) => {
        if (!messageIds || messageIds.length === 0) return
        const now = new Date().toISOString()
        await supabase
            .from('messages')
            .update({ read_at: now })
            .in('id', messageIds)
    }

    // React to message
    const reactMessage = async (messageId, reaction, currentReactions = {}) => {
        let nextReactions = { ...currentReactions }
        // Toggle if same reaction
        if (nextReactions[userId] === reaction) {
            delete nextReactions[userId]
        } else {
            nextReactions[userId] = reaction
        }
        await supabase.from('messages').update({ reactions: nextReactions }).eq('id', messageId)
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

    return { messages, sendMessage, deleteMessage, clearChat, uploadImage, sending, isTyping, sendTyping, markAsRead, reactMessage }
}
