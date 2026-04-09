/**
 * Push Notification Service for Chat WS Server
 * Sends Expo push notifications to offline users when they receive messages.
 */
import { Expo } from 'expo-server-sdk';

export class PushService {
    private expo = new Expo();

    async sendPushNotification(
        pushToken: string,
        title: string,
        body: string,
        data: Record<string, any> = {}
    ): Promise<void> {
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`[PushService] Invalid push token: ${pushToken}`);
            return;
        }

        try {
            const ticketChunk = await this.expo.sendPushNotificationsAsync([
                {
                    to: pushToken,
                    sound: 'default' as const,
                    title,
                    body,
                    data,
                },
            ]);
            console.log('[PushService] Sent notification:', ticketChunk);
        } catch (error) {
            console.error('[PushService] Error sending push notification:', error);
        }
    }
}

let instance: PushService | null = null;

export function getPushService(): PushService {
    if (!instance) {
        instance = new PushService();
    }
    return instance;
}
