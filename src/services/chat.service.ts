/**
 * Chat Service — Prisma operations for the WebSocket server.
 * Shared database with Alcovian-Syllabus-API.
 */
import prisma from '../prisma.js';

/**
 * Get all conversation IDs a user participates in.
 */
export async function getUserConversations(userId: string): Promise<string[]> {
    const participants = await prisma.chatParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
    });
    return participants.map((p: any) => p.conversationId);
}

/**
 * Check if a user is a participant in a given conversation.
 */
export async function isParticipant(userId: string, conversationId: string): Promise<boolean> {
    const participant = await prisma.chatParticipant.findUnique({
        where: {
            conversationId_userId: {
                conversationId,
                userId,
            },
        },
    });
    return participant !== null;
}

/**
 * Persist a new message to the database.
 * Returns the created message with sender info.
 */
export async function createMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: string = 'text'
) {
    const message = await prisma.chatMessage.create({
        data: {
            conversationId,
            senderId,
            content,
            messageType,
        },
        include: {
            sender: {
                select: { id: true, name: true },
            },
        },
    });

    // Update the conversation's updatedAt timestamp
    await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: message.sender.name,
        content: message.content,
        messageType: message.messageType,
        createdAt: message.createdAt.toISOString(),
    };
}

/**
 * Get a user's display name by ID.
 */
export async function getUserName(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });
    return user?.name ?? 'Unknown';
}

/**
 * Get all participant user IDs for a conversation.
 */
export async function getConversationParticipantIds(conversationId: string): Promise<string[]> {
    const participants = await prisma.chatParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
    });
    return participants.map((p:any) => p.userId);
}
