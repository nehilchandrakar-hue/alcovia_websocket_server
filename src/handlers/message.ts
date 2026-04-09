/**
 * Message Handler
 * Processes incoming chat messages: validation, persistence, broadcast.
 * Sends push notifications to offline participants.
 */
import type { WebSocket } from 'ws';
import { sendToUser, connectedClients } from './connection.js';
import {
    isParticipant,
    createMessage,
    getConversationParticipantIds,
    getUserPushToken,
} from '../services/chat.service.js';
import { getPushService } from '../services/push.service.js';

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

        // Send push notifications to offline participants
        const senderName = savedMessage.senderName;
        const pushService = getPushService();

        for (const participantId of participantIds) {
            // Skip the sender
            if (participantId === userId) continue;

            // Check if the participant has any active WebSocket connections
            const isOnline = connectedClients.has(participantId) &&
                (connectedClients.get(participantId)?.size ?? 0) > 0;

            if (!isOnline) {
                // Participant is offline — send push notification
                const pushToken = await getUserPushToken(participantId);
                if (pushToken) {
                    const truncatedContent = content.length > 100
                        ? content.substring(0, 100) + '...'
                        : content;

                    pushService.sendPushNotification(
                        pushToken,
                        senderName,
                        truncatedContent,
                        {
                            type: 'chat_message',
                            conversationId,
                            senderId: userId,
                            senderName,
                        }
                    ).catch((err) => {
                        console.error(`[WS] Failed to send push to ${participantId}:`, err);
                    });
                }
            }
        }
    } catch (err) {
        console.error(`[WS] Failed to process message from ${userId}:`, err);
        ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Failed to send message' },
        }));
    }
}
