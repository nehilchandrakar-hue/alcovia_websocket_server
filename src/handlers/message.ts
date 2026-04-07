/**
 * Message Handler
 * Processes incoming chat messages: validation, persistence, broadcast.
 */
import type { WebSocket } from 'ws';
import { sendToUser } from './connection.js';
import {
    isParticipant,
    createMessage,
    getConversationParticipantIds,
} from '../services/chat.service.js';

interface IncomingMessage {
    conversationId: string;
    content: string;
    messageType?: string;
}

/**
 * Handle an incoming message from a client.
 */
export async function handleMessage(
    ws: WebSocket,
    userId: string,
    payload: IncomingMessage
): Promise<void> {
    const { conversationId, content, messageType } = payload;

    // Validate required fields
    if (!conversationId || !content) {
        ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'conversationId and content are required' },
        }));
        return;
    }

    // Verify user is a participant of the conversation
    const isMember = await isParticipant(userId, conversationId);
    if (!isMember) {
        ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'You are not a participant of this conversation' },
        }));
        return;
    }

    try {
        // Persist message to database
        const savedMessage = await createMessage(
            conversationId,
            userId,
            content,
            messageType || 'text'
        );

        // Get all participants to broadcast to
        const participantIds = await getConversationParticipantIds(conversationId);

        // Broadcast to all participants' connected sockets
        const broadcastPayload = {
            type: 'message',
            payload: savedMessage,
        };

        for (const participantId of participantIds) {
            sendToUser(participantId, broadcastPayload);
        }
    } catch (err) {
        console.error(`[WS] Failed to process message from ${userId}:`, err);
        ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Failed to send message' },
        }));
    }
}
