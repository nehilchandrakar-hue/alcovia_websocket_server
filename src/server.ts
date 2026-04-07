/**
 * Alcovian Chat WebSocket Server
 * Standalone real-time messaging server using ws library.
 * Shares the same database as the main Alcovian-Syllabus-API.
 */
import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse as parseUrl } from 'url';
import { verifyToken, type TokenPayload } from './auth.js';
import { handleConnection, handleDisconnect } from './handlers/connection.js';
import { handleMessage } from './handlers/message.js';
import { handleTyping } from './handlers/typing.js';

const PORT = parseInt(process.env.PORT || '3002', 10);

// Create HTTP server (required for upgrade handling)
const server = createServer((_req, res) => {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'alcovian-chat-ws' }));
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

// Handle HTTP upgrade to WebSocket with JWT authentication
server.on('upgrade', (request, socket, head) => {
    const { query } = parseUrl(request.url || '', true);
    const token = query.token as string | undefined;

    if (!token) {
        console.warn('[WS] Connection rejected: no token provided');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    const user = verifyToken(token);
    if (!user) {
        console.warn('[WS] Connection rejected: invalid token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    // Complete the WebSocket upgrade
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, user);
    });
});

// Handle new authenticated WebSocket connections
wss.on('connection', (ws: WebSocket, user: TokenPayload) => {
    // Set up the connection (tracking, initial data)
    handleConnection(ws, user);

    // Handle incoming messages
    ws.on('message', async (raw: Buffer) => {
        try {
            const data = JSON.parse(raw.toString());
            const { type, payload } = data;

            switch (type) {
                case 'message':
                    await handleMessage(ws, user.userId, payload);
                    break;
                case 'typing':
                    await handleTyping(ws, user.userId, payload);
                    break;
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        payload: { message: `Unknown message type: ${type}` },
                    }));
            }
        } catch (err) {
            console.error('[WS] Failed to parse message:', err);
            ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Invalid message format' },
            }));
        }
    });

    // Handle disconnect
    ws.on('close', () => {
        handleDisconnect(ws, user.userId);
    });

    // Handle errors
    ws.on('error', (err) => {
        console.error(`[WS] Error for user ${user.userId}:`, err);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`[Alcovian Chat WS] Server listening on port ${PORT}`);
    console.log(`[Alcovian Chat WS] WebSocket endpoint: ws://localhost:${PORT}?token=<jwt>`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[WS] SIGTERM received, shutting down...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('[WS] SIGINT received, shutting down...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});
