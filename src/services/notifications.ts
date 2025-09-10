import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import NotificationTemplates, { TemplateData } from './notifications/templates';
import SMSService from './notifications/sms';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  type: 'contribution_due' | 'payout_ready' | 'group_update' | 'payment_reminder' | 'general' | 'late_payment' | 'cycle_completed' | 'payout_next' | 'member_joined';
  userId: string;
  groupId?: string;
  contributionId?: string;
  payoutId?: string;
  data?: Record<string, any>;
  createdAt: Date;
  read: boolean;
  templateId?: string;
  priority?: 'low' | 'normal' | 'high' | 'max';
  category?: string;
  scheduledFor?: Date;
  smsEnabled?: boolean;
  emailEnabled?: boolean;
}

export interface SendNotificationParams {
  templateId: string;
  userId: string;
  data: TemplateData;
  sendSMS?: boolean;
  sendEmail?: boolean;
  scheduleFor?: Date;
  groupId?: string;
}

class NotificationService {
  private fcmToken: string | null = null;

  // Initialize notifications
  async initialize(): Promise<boolean> {
    try {
      // Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.log('Notification permission denied');
        return false;
      }

      // Get FCM token
      const token = await this.getFCMToken();
      if (!token) {
        console.log('Failed to get FCM token');
        return false;
      }

      // Set up message handlers
      this.setupMessageHandlers();
      
      // Set up token refresh listener
      this.setupTokenRefreshListener();

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      }

      // iOS
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      return enabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Get FCM token
  async getFCMToken(): Promise<string | null> {
    try {
      const storedToken = await AsyncStorage.getItem('fcm_token');
      const currentToken = await messaging().getToken();

      if (storedToken !== currentToken) {
        await AsyncStorage.setItem('fcm_token', currentToken);
        this.fcmToken = currentToken;
        
        // Update token in Firestore if user is authenticated
        await this.updateTokenInFirestore(currentToken);
      } else {
        this.fcmToken = storedToken;
      }

      return this.fcmToken;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Update FCM token in Firestore
  async updateTokenInFirestore(token: string, userId?: string): Promise<void> {
    try {
      if (userId) {
        await db.collection('users').doc(userId).update({
          fcmToken: token,
          tokenUpdatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating FCM token in Firestore:', error);
    }
  }

  // Set up message handlers
  private setupMessageHandlers(): void {
    // Handle messages when app is in background/quit state
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);
      await this.handleBackgroundMessage(remoteMessage);
    });

    // Handle messages when app is in foreground
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message:', remoteMessage);
      this.handleForegroundMessage(remoteMessage);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationOpened(remoteMessage);
    });

    // Check if app was opened from a notification when app was quit
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('Initial notification:', remoteMessage);
          this.handleNotificationOpened(remoteMessage);
        }
      });
  }

  // Set up token refresh listener
  private setupTokenRefreshListener(): void {
    messaging().onTokenRefresh(async (token) => {
      console.log('FCM token refreshed:', token);
      await AsyncStorage.setItem('fcm_token', token);
      this.fcmToken = token;
      
      // Update token in Firestore
      await this.updateTokenInFirestore(token);
    });
  }

  // Handle foreground messages
  private handleForegroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    if (remoteMessage.notification) {
      Alert.alert(
        remoteMessage.notification.title || 'Ajoturn',
        remoteMessage.notification.body || 'You have a new notification',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View', onPress: () => this.handleNotificationOpened(remoteMessage) },
        ]
      );
    }
  }

  // Handle background messages
  private async handleBackgroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    // Save notification to local storage for later processing
    try {
      const notifications = await this.getStoredNotifications();
      const newNotification: NotificationData = {
        id: remoteMessage.messageId || Date.now().toString(),
        title: remoteMessage.notification?.title || 'Ajoturn',
        body: remoteMessage.notification?.body || 'New notification',
        type: (remoteMessage.data?.type as any) || 'general',
        userId: remoteMessage.data?.userId as string || '',
        groupId: remoteMessage.data?.groupId as string,
        contributionId: remoteMessage.data?.contributionId as string,
        payoutId: remoteMessage.data?.payoutId as string,
        data: remoteMessage.data,
        createdAt: new Date(),
        read: false,
      };

      notifications.unshift(newNotification);
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(notifications.slice(0, 50))); // Keep last 50 notifications
    } catch (error) {
      console.error('Error handling background message:', error);
    }
  }

  // Handle notification opened
  private handleNotificationOpened(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    const data = remoteMessage.data;
    
    if (data?.type === 'contribution_due' && data?.groupId) {
      // Navigate to group contributions screen
      console.log('Navigate to contributions for group:', data.groupId);
    } else if (data?.type === 'payout_ready' && data?.groupId) {
      // Navigate to group payouts screen
      console.log('Navigate to payouts for group:', data.groupId);
    } else if (data?.type === 'group_update' && data?.groupId) {
      // Navigate to group details screen
      console.log('Navigate to group details:', data.groupId);
    }
    
    // Mark notification as read if it has an ID
    if (data?.notificationId) {
      this.markNotificationAsRead(data.notificationId);
    }
  }

  // Get stored notifications
  async getStoredNotifications(): Promise<NotificationData[]> {
    try {
      const stored = await AsyncStorage.getItem('stored_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting stored notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getStoredNotifications();
      const updatedNotifications = notifications.map(notification =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      );
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Send notification using template
  async sendToUser(params: SendNotificationParams): Promise<boolean> {
    try {
      const { templateId, userId, data, sendSMS = false, sendEmail = false, scheduleFor, groupId } = params;
      
      // Render template
      const template = NotificationTemplates.renderTemplate(templateId, data);
      if (!template) {
        console.error(`Template not found: ${templateId}`);
        return false;
      }

      // Create notification data
      const notificationData: Omit<NotificationData, 'id'> = {
        title: template.title,
        body: template.body,
        type: template.type as NotificationData['type'],
        userId,
        templateId,
        priority: template.priority,
        category: template.category,
        groupId,
        data,
        createdAt: new Date(),
        read: false,
        scheduledFor,
        smsEnabled: sendSMS,
        emailEnabled: sendEmail,
      };

      if (scheduleFor && scheduleFor > new Date()) {
        // Schedule notification for later
        return await this.scheduleNotification(notificationData);
      } else {
        // Send immediately
        return await this.sendImmediately(notificationData, template);
      }
    } catch (error) {
      console.error('Error sending notification to user:', error);
      return false;
    }
  }

  // Send notification immediately
  private async sendImmediately(notificationData: Omit<NotificationData, 'id'>, template: any): Promise<boolean> {
    try {
      // Store in database
      const docRef = await db.collection('notifications').add(notificationData);
      const notificationId = docRef.id;

      // Send push notification via FCM
      await this.sendPushNotification(notificationData.userId, {
        title: template.title,
        body: template.body,
        data: {
          notificationId,
          type: template.type,
          groupId: notificationData.groupId || '',
          ...notificationData.data,
        },
      });

      // Send SMS if enabled and template has SMS content
      if (notificationData.smsEnabled && template.smsTemplate) {
        await this.sendSMS(notificationData.userId, template.smsTemplate);
      }

      // Send email if enabled (would be implemented separately)
      if (notificationData.emailEnabled) {
        await this.sendEmail(notificationData.userId, template.title, template.body);
      }

      return true;
    } catch (error) {
      console.error('Error sending immediate notification:', error);
      return false;
    }
  }

  // Schedule notification for later delivery
  private async scheduleNotification(notificationData: Omit<NotificationData, 'id'>): Promise<boolean> {
    try {
      // Store scheduled notification in database
      await db.collection('scheduled_notifications').add(notificationData);
      console.log(`Notification scheduled for ${notificationData.scheduledFor}`);
      return true;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return false;
    }
  }

  // Send push notification via FCM
  private async sendPushNotification(userId: string, payload: { title: string; body: string; data: any }): Promise<void> {
    try {
      // Get user's FCM token from Firestore
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return;
      }

      // This would typically use Firebase Admin SDK on the server
      // For now, we'll log what would be sent
      console.log('Sending push notification:', {
        to: userData.fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Send SMS
  private async sendSMS(userId: string, message: string): Promise<boolean> {
    try {
      // Get user's phone number from database
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.phoneNumber) {
        console.log(`No phone number found for user ${userId}`);
        return false;
      }

      return await SMSService.sendSMS(userData.phoneNumber, message);
    } catch (error) {
      console.error('Error sending SMS:', error);
      return false;
    }
  }

  // Send email (placeholder for future implementation)
  private async sendEmail(userId: string, subject: string, body: string): Promise<boolean> {
    try {
      // Get user's email from database
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.email) {
        console.log(`No email found for user ${userId}`);
        return false;
      }

      // Email implementation would go here
      console.log(`Email would be sent to ${userData.email}: ${subject}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Legacy method for backward compatibility
  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    type: NotificationData['type'],
    additionalData?: Record<string, any>
  ): Promise<boolean> {
    const notificationData: Omit<NotificationData, 'id'> = {
      title,
      body,
      type,
      userId,
      data: additionalData,
      createdAt: new Date(),
      read: false,
      ...additionalData,
    };

    await db.collection('notifications').add(notificationData);
    return true;
  }

  // Subscribe to topic (for group notifications)
  async subscribeToTopic(topic: string): Promise<boolean> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`Subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  // Unsubscribe from topic
  async unsubscribeFromTopic(topic: string): Promise<boolean> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`Unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  }

  // Get unread notification count
  async getUnreadNotificationCount(): Promise<number> {
    try {
      const notifications = await this.getStoredNotifications();
      return notifications.filter(notification => !notification.read).length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem('stored_notifications');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  // Check notification permission status
  async checkPermissionStatus(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted;
        }
        return true;
      }

      // iOS
      const authStatus = await messaging().hasPermission();
      return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
             authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  getCurrentToken(): string | null {
    return this.fcmToken;
  }
}

export default new NotificationService();