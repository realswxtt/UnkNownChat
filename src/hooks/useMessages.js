import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'

export function useMessages(userId, receiverId, activeSpace = null) {
    const [messages, setMessages] = useState([])
    const [sending, setSending] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const channelRef = useRef(null)

    // Fetch history
    useEffect(() => {
        if (!userId) return

        let query = supabase.from('messages').select('*')

        if (activeSpace) {
            query = query.eq('space_id', activeSpace.id)
        } else if (receiverId) {
            query = query.or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`)
                .is('space_id', null)
        } else {
            return
        }

        query.order('created_at', { ascending: true })
            .then(({ data }) => { if (data) setMessages(data) })
    }, [userId, receiverId, activeSpace])

    // Realtime subscription
    useEffect(() => {
        if (!userId) return
        if (!activeSpace && !receiverId) return

        setIsTyping(false) // Reset on switch

        const channelName = activeSpace
            ? `rt-space-${activeSpace.id}`
            : `rt-${userId}-${receiverId}`

        const ch = supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const msg = payload.new

                if (activeSpace) {
                    if (msg.space_id === activeSpace.id) {
                        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
                    }
                } else {
                    if (
                        !msg.space_id &&
                        ((msg.sender_id === userId && msg.receiver_id === receiverId) ||
                            (msg.sender_id === receiverId && msg.receiver_id === userId))
                    ) {
                        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
                    }
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
                // Determine if typing event is relevant
                if (activeSpace && payload.payload.spaceId === activeSpace.id && payload.payload.userId !== userId) {
                    setIsTyping(payload.payload.isTyping)
                } else if (!activeSpace && payload.payload.userId === receiverId) {
                    setIsTyping(payload.payload.isTyping)
                }
            })
            .subscribe()

        channelRef.current = ch

        return () => {
            channelRef.current = null
            ch.unsubscribe()
        }
    }, [userId, receiverId, activeSpace])

    // Typing Event
    const sendTyping = (typing) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId, isTyping: typing, spaceId: activeSpace?.id }
            })
        }
    }

    // Send message
    const sendMessage = async (content, imageUrl = null, replyTo = null, audioUrl = null) => {
        if ((!content.trim() && !imageUrl && !audioUrl) || sending) return false
        if (!activeSpace && !receiverId) return false

        setSending(true)
        const { error } = await supabase.from('messages').insert({
            sender_id: userId,
            receiver_id: activeSpace ? null : receiverId,
            space_id: activeSpace ? activeSpace.id : null,
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
        const { error } = await supabase
            .from('messages')
            .update({ read_at: now })
            .in('id', messageIds)
        if (error) console.error("Error marking as read (posible bloqueo RLS):", error)
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
