import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { MainStackScreenProps } from '../../navigation/types';

type Props = MainStackScreenProps<'Notifications'>;

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'payment' | 'group' | 'payout' | 'reminder' | 'system';
  timestamp: string;
  read: boolean;
  actionData?: {
    groupId?: string;
    paymentId?: string;
    action?: 'view_group' | 'make_payment' | 'view_payment';
  };
}

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sampleNotifications: Notification[] = [
    {
      id: '1',
      title: 'Payment Due Soon',
      message: 'Your contribution for "Weekly Savings Group" is due in 2 days. Amount: ₦50,000',
      type: 'reminder',
      timestamp: '2024-03-10T10:30:00',
      read: false,
      actionData: { groupId: 'group1', action: 'make_payment' },
    },
    {
      id: '2',
      title: 'Payment Received',
      message: 'John Doe has made their contribution to "Monthly Investment Group"',
      type: 'payment',
      timestamp: '2024-03-09T14:15:00',
      read: false,
      actionData: { groupId: 'group2', action: 'view_group' },
    },
    {
      id: '3',
      title: 'Your Turn for Payout!',
      message: '🎉 Congratulations! You will receive the payout of ₦500,000 from "Family Savings Circle" tomorrow',
      type: 'payout',
      timestamp: '2024-03-08T09:00:00',
      read: true,
      actionData: { groupId: 'group3', action: 'view_group' },
    },
    {
      id: '4',
      title: 'New Member Joined',
      message: 'Jane Smith has joined "Office Colleagues Group"',
      type: 'group',
      timestamp: '2024-03-07T16:45:00',
      read: true,
      actionData: { groupId: 'group4', action: 'view_group' },
    },
    {
      id: '5',
      title: 'Group Created Successfully',
      message: 'Your new group "Monthly Investment Group" has been created. Start inviting members!',
      type: 'group',
      timestamp: '2024-03-06T11:20:00',
      read: true,
      actionData: { groupId: 'group5', action: 'view_group' },
    },
    {
      id: '6',
      title: 'App Update Available',
      message: 'A new version of Ajoturn is available with exciting new features!',
      type: 'system',
      timestamp: '2024-03-05T08:00:00',
      read: true,
    },
  ];

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNotifications(sampleNotifications);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setNotifications(prev => prev.filter(notif => notif.id !== id));
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionData) {
      switch (notification.actionData.action) {
        case 'view_group':
          navigation.navigate('GroupDetails', {
            groupId: notification.actionData.groupId!,
            groupName: 'Group',
          });
          break;
        case 'make_payment':
          navigation.navigate('Payment', {
            groupId: notification.actionData.groupId!,
            amount: 50000,
          });
          break;
        case 'view_payment':
          navigation.navigate('PaymentHistory', {
            groupId: notification.actionData.groupId,
          });
          break;
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment': return '💰';
      case 'group': return '👥';
      case 'payout': return '🎉';
      case 'reminder': return '⏰';
      case 'system': return '⚙️';
      default: return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'payment': return '#38a169';
      case 'group': return '#3182ce';
      case 'payout': return '#d69e2e';
      case 'reminder': return '#e53e3e';
      case 'system': return '#718096';
      default: return '#4a5568';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
      onLongPress={() => deleteNotification(item.id)}
    >
      <View style={styles.notificationIcon}>
        <Text style={styles.iconText}>{getNotificationIcon(item.type)}</Text>
      </View>
      
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>
          {item.title}
        </Text>
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.notificationTime}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
      
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.header}>
          <Text style={styles.unreadCount}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllRead}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll see updates about your groups and payments here
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  unreadCount: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  markAllRead: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadItem: {
    backgroundColor: '#f7fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#3182ce',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#718096',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3182ce',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;