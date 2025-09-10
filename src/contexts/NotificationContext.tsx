import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  fcmToken: string | null;
  hasPermission: boolean;
  loading: boolean;
  requestPermission: () => Promise<boolean>;
  markAsRead: (notificationId: string) => void;
  clearNotifications: () => void;
  sendTestNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  fcmToken: null,
  hasPermission: false,
  loading: false,
  requestPermission: async () => false,
  markAsRead: () => {},
  clearNotifications: () => {},
  sendTestNotification: async () => {},
});

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestPermission = async (): Promise<boolean> => {
    try {
      setLoading(true);
      
      if (Platform.OS === 'android') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
        setHasPermission(enabled);
        
        if (enabled) {
          const token = await messaging().getToken();
          setFcmToken(token);
          console.log('FCM Token:', token);
        }
        
        return enabled;
      }
      
      // For iOS
      const authStatus = await messaging().requestPermission({
        alert: true,
        badge: true,
        sound: true,
      });
      
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      setHasPermission(enabled);
      
      if (enabled) {
        const token = await messaging().getToken();
        setFcmToken(token);
        console.log('FCM Token:', token);
      }
      
      return enabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const sendTestNotification = async () => {
    if (!fcmToken) {
      Alert.alert('Error', 'No FCM token available');
      return;
    }
    
    // This would typically be done from your backend
    // For testing, you can use the Firebase Console or a cloud function
    console.log('Test notification would be sent to token:', fcmToken);
    Alert.alert('Test', 'Test notification would be sent (check console for token)');
  };

  const addNotification = (title: string, body: string, data?: any) => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      title,
      body,
      data,
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
  };

  useEffect(() => {
    let unsubscribeOnMessage: (() => void) | undefined;
    let unsubscribeOnNotificationOpenedApp: (() => void) | undefined;

    const initializeMessaging = async () => {
      try {
        // Check if we already have permission
        const authStatus = await messaging().hasPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
        setHasPermission(enabled);
        
        if (enabled) {
          const token = await messaging().getToken();
          setFcmToken(token);
        }

        // Handle foreground messages
        unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
          console.log('Foreground message received:', remoteMessage);
          
          if (remoteMessage.notification) {
            addNotification(
              remoteMessage.notification.title || 'New Message',
              remoteMessage.notification.body || '',
              remoteMessage.data
            );
          }
        });

        // Handle notification opened app
        unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
          console.log('Notification caused app to open:', remoteMessage);
          
          if (remoteMessage.notification) {
            addNotification(
              remoteMessage.notification.title || 'New Message',
              remoteMessage.notification.body || '',
              remoteMessage.data
            );
          }
        });

        // Check whether an initial notification is available
        messaging()
          .getInitialNotification()
          .then(remoteMessage => {
            if (remoteMessage) {
              console.log('App opened by notification:', remoteMessage);
              
              if (remoteMessage.notification) {
                addNotification(
                  remoteMessage.notification.title || 'New Message',
                  remoteMessage.notification.body || '',
                  remoteMessage.data
                );
              }
            }
          });
      } catch (error) {
        console.error('Error initializing messaging:', error);
      }
    };

    if (user) {
      initializeMessaging();
    }

    return () => {
      if (unsubscribeOnMessage) {
        unsubscribeOnMessage();
      }
      if (unsubscribeOnNotificationOpenedApp) {
        unsubscribeOnNotificationOpenedApp();
      }
    };
  }, [user]);

  // Token refresh listener
  useEffect(() => {
    const unsubscribe = messaging().onTokenRefresh(token => {
      console.log('FCM token refreshed:', token);
      setFcmToken(token);
    });

    return unsubscribe;
  }, []);

  const value: NotificationContextType = {
    notifications,
    fcmToken,
    hasPermission,
    loading,
    requestPermission,
    markAsRead,
    clearNotifications,
    sendTestNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};