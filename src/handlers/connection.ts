/**
 * Connection Handler
 * Manages client connections: tracking, initial data load, room joining.
 */
import type { WebSocket } from 'ws';
import type { TokenPayload } from '../auth.js';
import { getUserConversations } from '../services/chat.service.js';

/** Map of userId -> Set of connected WebSocket clients */
export const connectedClients = new Map<string, Set<WebSocket>>();

/**
 * Handle a new authenticated WebSocket connection.
 */
export async function handleConnection(ws: WebSocket, user: TokenPayload): Promise<void> {
    const { userId } = user;

    // Track connected client
    if (!connectedClients.has(userId)) {
        connectedClients.set(userId, new Set());
    }
    connectedClients.get(userId)!.add(ws);

    console.log(`[WS] User ${userId} connected. Active connections: ${connectedClients.get(userId)!.size}`);

    // Send connection acknowledgment
    ws.send(JSON.stringify({
        type: 'connected',
        payload: { userId },
    }));

    // Load user's conversations and notify which rooms they've joined
    try {
        const conversationIds = await getUserConversations(userId);
        ws.send(JSON.stringify({
            type: 'conversations',
            payload: { conversationIds },
        }));
    } catch (err) {
        console.error(`[WS] Failed to load conversations for user ${userId}:`, err);
    }
}

/**
 * Handle client disconnect: remove from tracking map.
 */
export function handleDisconnect(ws: WebSocket, userId: string): void {
    const userSockets = connectedClients.get(userId);
    if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
            connectedClients.delete(userId);
        }
    }
    console.log(`[WS] User ${userId} disconnected. Remaining connections: ${connectedClients.get(userId)?.size ?? 0}`);
}

/**
 * Send a message to all connected sockets of a given user.
 */
export function sendToUser(userId: string, data: object): void {
    const sockets = connectedClients.get(userId);
    if (!sockets) return;

    const payload = JSON.stringify(data);
    for (const socket of sockets) {
        if (socket.readyState === 1 /* WebSocket.OPEN */) {
            socket.send(payload);
        }
    }
}
