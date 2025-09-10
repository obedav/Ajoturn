import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage wrapper using AsyncStorage instead of MMKV
export const storage = {
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
  getString: (key: string) => AsyncStorage.getItem(key),
  delete: (key: string) => AsyncStorage.removeItem(key),
  clearAll: () => AsyncStorage.clear(),
  getAllKeys: () => AsyncStorage.getAllKeys(),
};

// Network monitoring
class NetworkManager {
  private static instance: NetworkManager;
  private isOnline: boolean = true;
  private listeners: Array<(isOnline: boolean) => void> = [];

  private constructor() {
    this.initializeNetworkListener();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable;
      if (this.isOnline !== isOnline) {
        this.isOnline = isOnline || false;
        this.notifyListeners();
      }
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      this.isOnline = (state.isConnected && state.isInternetReachable) || false;
      this.notifyListeners();
    });
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  public addListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  public async checkConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return (state.isConnected && state.isInternetReachable) || false;
  }
}

export const networkManager = NetworkManager.getInstance();

// Storage utilities for offline caching
export const offlineStorage = {
  // Store data with expiration
  set: async (key: string, data: any, expirationMinutes: number = 60) => {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        expiration: Date.now() + (expirationMinutes * 60 * 1000),
      };
      await storage.set(key, JSON.stringify(item));
    } catch (error) {
      console.error('Error storing data:', error);
    }
  },

  // Get data if not expired
  get: async (key: string): Promise<any> => {
    try {
      const itemString = await storage.getString(key);
      if (!itemString) return null;

      const item = JSON.parse(itemString);
      if (Date.now() > item.expiration) {
        await storage.delete(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  },

  // Remove specific item
  remove: async (key: string) => {
    await storage.delete(key);
  },

  // Clear all cached data
  clearAll: async () => {
    await storage.clearAll();
  },

  // Get all keys for debugging
  getAllKeys: async (): Promise<string[]> => {
    return await storage.getAllKeys();
  },

  // Check if key exists and is not expired
  has: async (key: string): Promise<boolean> => {
    try {
      const itemString = await storage.getString(key);
      if (!itemString) return false;

      const item = JSON.parse(itemString);
      return Date.now() <= item.expiration;
    } catch {
      return false;
    }
  },
};

// Offline queue for actions that need to be performed when online
export interface QueuedAction {
  id: string;
  type: 'CREATE_GROUP' | 'MAKE_PAYMENT' | 'UPDATE_PROFILE' | 'JOIN_GROUP';
  data: any;
  timestamp: number;
  retries: number;
}

export const offlineQueue = {
  // Add action to queue
  enqueue: async (type: QueuedAction['type'], data: any): Promise<string> => {
    const action: QueuedAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    const queue = await offlineQueue.getAll();
    queue.push(action);
    await storage.set('offline_queue', JSON.stringify(queue));
    return action.id;
  },

  // Get all queued actions
  getAll: async (): Promise<QueuedAction[]> => {
    try {
      const queueString = await storage.getString('offline_queue');
      return queueString ? JSON.parse(queueString) : [];
    } catch {
      return [];
    }
  },

  // Remove action from queue
  remove: async (actionId: string) => {
    const queue = (await offlineQueue.getAll()).filter(action => action.id !== actionId);
    await storage.set('offline_queue', JSON.stringify(queue));
  },

  // Process all queued actions when online
  processQueue: async (processor: (action: QueuedAction) => Promise<boolean>) => {
    if (!networkManager.getNetworkStatus()) {
      console.log('Cannot process queue: offline');
      return;
    }

    const queue = await offlineQueue.getAll();
    for (const action of queue) {
      try {
        const success = await processor(action);
        if (success) {
          await offlineQueue.remove(action.id);
        } else {
          // Increment retry count
          action.retries += 1;
          if (action.retries >= 3) {
            // Remove after 3 failed attempts
            offlineQueue.remove(action.id);
          } else {
            // Update the queue with incremented retry count
            const updatedQueue = queue.map(q => 
              q.id === action.id ? action : q
            );
            storage.set('offline_queue', JSON.stringify(updatedQueue));
          }
        }
      } catch (error) {
        console.error('Error processing queued action:', error);
        action.retries += 1;
        if (action.retries >= 3) {
          offlineQueue.remove(action.id);
        }
      }
    }
  },

  // Clear entire queue
  clear: () => {
    storage.delete('offline_queue');
  },
};

// User preferences storage
export const userPreferences = {
  set: (key: string, value: any) => {
    storage.set(`pref_${key}`, JSON.stringify(value));
  },

  get: (key: string, defaultValue: any = null): any => {
    try {
      const value = storage.getString(`pref_${key}`);
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  remove: (key: string) => {
    storage.delete(`pref_${key}`);
  },

  // Common preferences
  setTheme: (theme: 'light' | 'dark') => userPreferences.set('theme', theme),
  getTheme: (): 'light' | 'dark' => userPreferences.get('theme', 'light'),
  
  setNotificationsEnabled: (enabled: boolean) => userPreferences.set('notifications', enabled),
  getNotificationsEnabled: (): boolean => userPreferences.get('notifications', true),
  
  setBiometricEnabled: (enabled: boolean) => userPreferences.set('biometric', enabled),
  getBiometricEnabled: (): boolean => userPreferences.get('biometric', false),
};

// App state cache
export const appCache = {
  // Cache user dashboard data
  cacheUserDashboard: (userId: string, data: any) => {
    offlineStorage.set(`dashboard_${userId}`, data, 30); // 30 minutes
  },

  getCachedUserDashboard: (userId: string) => {
    return offlineStorage.get(`dashboard_${userId}`);
  },

  // Cache group details
  cacheGroupDetails: (groupId: string, data: any) => {
    offlineStorage.set(`group_${groupId}`, data, 15); // 15 minutes
  },

  getCachedGroupDetails: (groupId: string) => {
    return offlineStorage.get(`group_${groupId}`);
  },

  // Cache payment history
  cachePaymentHistory: (userId: string, data: any) => {
    offlineStorage.set(`payments_${userId}`, data, 60); // 1 hour
  },

  getCachedPaymentHistory: (userId: string) => {
    return offlineStorage.get(`payments_${userId}`);
  },
};

// Network-aware data fetcher
export const networkAwareFetch = async <T>(
  key: string,
  fetchFunction: () => Promise<T>,
  cacheMinutes: number = 30
): Promise<T | null> => {
  // First check cache
  const cached = offlineStorage.get(key);
  
  if (networkManager.getNetworkStatus()) {
    // Online: fetch fresh data
    try {
      const data = await fetchFunction();
      offlineStorage.set(key, data, cacheMinutes);
      return data;
    } catch (error) {
      console.error('Network fetch failed, returning cached data:', error);
      return cached;
    }
  } else {
    // Offline: return cached data
    return cached;
  }
};