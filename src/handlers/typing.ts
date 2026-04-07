/**
 * Typing Handler
 * Broadcasts typing indicators to other participants in a conversation.
 */
import type { WebSocket } from 'ws';
import { sendToUser } from './connection.js';
import {
    isParticipant,
    getConversationParticipantIds,
} from '../services/chat.service.js';

interface TypingPayload {
    conversationId: string;
}

/**
 * Handle a typing indicator from a client.
 * Broadcasts to all other participants in the conversation.
 */
export async function handleTyping(
    ws: WebSocket,
    userId: string,
    payload: TypingPayload
): Promise<void> {
    const { conversationId } = payload;

    if (!conversationId) return;

    // Verify membership
    const isMember = await isParticipant(userId, conversationId);
    if (!isMember) return;

    try {
        const participantIds = await getConversationParticipantIds(conversationId);

        const broadcastPayload = {
            type: 'typing',
            payload: { conversationId, userId },
        };

        // Send to all participants except the sender
        for (const participantId of participantIds) {
            if (participantId !== userId) {
                sendToUser(participantId, broadcastPayload);
            }
        }
    } catch (err) {
        console.error(`[WS] Failed to broadcast typing for ${userId}:`, err);
    }
}
