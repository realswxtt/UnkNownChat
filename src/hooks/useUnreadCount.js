import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useUnreadCount(userId) {
    const [unreadPerChat, setUnreadPerChat] = useState({})
    const [totalUnread, setTotalUnread] = useState(0)

    useEffect(() => {
        if (!userId) {
            setUnreadPerChat({})
            setTotalUnread(0)
            return
        }

        const fetchUnread = async () => {
            const { data } = await supabase
                .from('messages')
                .select('id, sender_id')
                .eq('receiver_id', userId)
                .is('read_at', null)

            if (data) {
                const counts = {}
                let total = 0
                data.forEach(msg => {
                    counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1
                    total++
                })
                setUnreadPerChat(counts)
                setTotalUnread(total)
            }
        }

        fetchUnread()

        const ch = supabase
            .channel(`unread-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, (payload) => {
                const msg = payload.new
                if (!msg.read_at) {
                    fetchUnread()
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, (payload) => {
                const msg = payload.new
                if (msg.read_at) {
                    fetchUnread()
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => {
                fetchUnread()
            })
            .subscribe()

        return () => {
            ch.unsubscribe()
        }
    }, [userId])

    return { totalUnread, unreadPerChat }
}
