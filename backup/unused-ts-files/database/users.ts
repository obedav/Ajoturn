import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { 
  User, 
  DatabaseResult, 
  PaginatedResult, 
  QueryOptions, 
  FilterOptions,
  UserStatistics 
} from '../../types/database';

class UserService {
  private collection = db.collection('users');

  // Create a new user
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseResult<User>> {
    try {
      const userDoc: Omit<User, 'id'> = {
        ...userData,
        created_at: new Date(),
        updated_at: new Date(),
        
        // Set default values
        phone_verified: false,
        email_verified: false,
        identity_verified: false,
        total_groups: 0,
        total_contributions: 0,
        total_payouts_received: 0,
        reliability_score: 100, // Start with perfect score
        
        // Default notification preferences
        notification_preferences: {
          push_enabled: true,
          email_enabled: true,
          contribution_reminders: true,
          payout_alerts: true,
        },
      };

      const docRef = await this.collection.add({
        ...userDoc,
        created_at: firestore.FieldValue.serverTimestamp(),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      const createdUser: User = {
        id: docRef.id,
        ...userDoc,
      };

      return {
        success: true,
        data: createdUser,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get user by ID
  async getUserById(userId: string): Promise<DatabaseResult<User | null>> {
    try {
      const doc = await this.collection.doc(userId).get();
      
      if (!doc.exists) {
        return {
          success: true,
          data: null,
        };
      }

      const userData = doc.data() as Omit<User, 'id'>;
      const user: User = {
        id: doc.id,
        ...userData,
        created_at: userData.created_at?.toDate?.() || new Date(),
        updated_at: userData.updated_at?.toDate?.() || new Date(),
      };

      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get user by phone number
  async getUserByPhone(phone: string): Promise<DatabaseResult<User | null>> {
    try {
      const snapshot = await this.collection.where('phone', '==', phone).limit(1).get();
      
      if (snapshot.empty) {
        return {
          success: true,
          data: null,
        };
      }

      const doc = snapshot.docs[0];
      const userData = doc.data() as Omit<User, 'id'>;
      const user: User = {
        id: doc.id,
        ...userData,
        created_at: userData.created_at?.toDate?.() || new Date(),
        updated_at: userData.updated_at?.toDate?.() || new Date(),
      };

      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<DatabaseResult<User | null>> {
    try {
      const snapshot = await this.collection.where('email', '==', email).limit(1).get();
      
      if (snapshot.empty) {
        return {
          success: true,
          data: null,
        };
      }

      const doc = snapshot.docs[0];
      const userData = doc.data() as Omit<User, 'id'>;
      const user: User = {
        id: doc.id,
        ...userData,
        created_at: userData.created_at?.toDate?.() || new Date(),
        updated_at: userData.updated_at?.toDate?.() || new Date(),
      };

      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update user
  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<DatabaseResult<User>> {
    try {
      const updateData = {
        ...updates,
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      await this.collection.doc(userId).update(updateData);
      
      // Get updated user
      const result = await this.getUserById(userId);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Delete user (soft delete by marking as inactive)
  async deleteUser(userId: string): Promise<DatabaseResult<boolean>> {
    try {
      await this.collection.doc(userId).update({
        status: 'inactive',
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Search users by name
  async searchUsersByName(
    searchQuery: string, 
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<User>>> {
    try {
      const { limit = 20, offset = 0 } = options;
      
      // Firestore doesn't support full-text search, so we use array-contains for simple search
      // For production, consider using Algolia or similar service
      const snapshot = await this.collection
        .where('name', '>=', searchQuery)
        .where('name', '<=', searchQuery + '\uf8ff')
        .limit(limit + 1) // Get one extra to check if there are more
        .offset(offset)
        .get();

      const users: User[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const userData = doc.data() as Omit<User, 'id'>;
        users.push({
          id: doc.id,
          ...userData,
          created_at: userData.created_at?.toDate?.() || new Date(),
          updated_at: userData.updated_at?.toDate?.() || new Date(),
        });
      });

      return {
        success: true,
        data: {
          items: users,
          total_count: snapshot.size,
          has_more: snapshot.docs.length > limit,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get users with filters
  async getUsers(
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<User>>> {
    try {
      const { limit = 20, offset = 0, order_by = 'created_at', order_direction = 'desc' } = options;
      
      let query = this.collection.limit(limit + 1).offset(offset);

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.date_from && filters.date_to) {
        query = query
          .where('created_at', '>=', filters.date_from)
          .where('created_at', '<=', filters.date_to);
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const users: User[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const userData = doc.data() as Omit<User, 'id'>;
        users.push({
          id: doc.id,
          ...userData,
          created_at: userData.created_at?.toDate?.() || new Date(),
          updated_at: userData.updated_at?.toDate?.() || new Date(),
        });
      });

      return {
        success: true,
        data: {
          items: users,
          total_count: snapshot.size,
          has_more: snapshot.docs.length > limit,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Verify user's BVN
  async verifyBVN(userId: string, bvnData: any): Promise<DatabaseResult<boolean>> {
    try {
      // This would integrate with BVN verification service
      // For now, we'll just mark as verified
      await this.collection.doc(userId).update({
        bvn_verified: true,
        identity_verified: true,
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update user statistics
  async updateUserStatistics(userId: string, stats: Partial<UserStatistics>): Promise<DatabaseResult<boolean>> {
    try {
      const updates: any = {
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      if (stats.total_contributed !== undefined) {
        updates.total_contributions = firestore.FieldValue.increment(stats.total_contributed);
      }

      if (stats.total_received !== undefined) {
        updates.total_payouts_received = firestore.FieldValue.increment(stats.total_received);
      }

      if (stats.reliability_score !== undefined) {
        updates.reliability_score = stats.reliability_score;
      }

      await this.collection.doc(userId).update(updates);

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get user statistics
  async getUserStatistics(userId: string): Promise<DatabaseResult<UserStatistics | null>> {
    try {
      const userResult = await this.getUserById(userId);
      
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const user = userResult.data;
      
      // Calculate additional statistics from related collections
      const groupMembersSnapshot = await db.collection('group_members')
        .where('user_id', '==', userId)
        .get();

      const activeGroups = groupMembersSnapshot.docs.filter(doc => 
        doc.data().status === 'active'
      ).length;

      const completedGroups = groupMembersSnapshot.docs.filter(doc => 
        doc.data().status === 'inactive' && doc.data().payout_received === true
      ).length;

      const contributionsSnapshot = await db.collection('contributions')
        .where('user_id', '==', userId)
        .where('status', '==', 'paid')
        .get();

      const onTimeContributions = contributionsSnapshot.docs.filter(doc => 
        !doc.data().is_late
      ).length;

      const onTimePaymentRate = contributionsSnapshot.size > 0 
        ? (onTimeContributions / contributionsSnapshot.size) * 100 
        : 100;

      const statistics: UserStatistics = {
        user_id: userId,
        groups_joined: groupMembersSnapshot.size,
        groups_completed: completedGroups,
        total_contributed: user.total_contributions,
        total_received: user.total_payouts_received,
        reliability_score: user.reliability_score,
        on_time_payment_rate: onTimePaymentRate,
        current_active_groups: activeGroups,
      };

      return {
        success: true,
        data: statistics,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Real-time listener for user updates
  onUserUpdates(userId: string, callback: (user: User | null) => void): () => void {
    return this.collection.doc(userId).onSnapshot(
      (doc) => {
        if (doc.exists) {
          const userData = doc.data() as Omit<User, 'id'>;
          const user: User = {
            id: doc.id,
            ...userData,
            created_at: userData.created_at?.toDate?.() || new Date(),
            updated_at: userData.updated_at?.toDate?.() || new Date(),
          };
          callback(user);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to user updates:', error);
        callback(null);
      }
    );
  }

  // Batch update multiple users
  async batchUpdateUsers(updates: Array<{ userId: string; data: Partial<User> }>): Promise<DatabaseResult<boolean>> {
    try {
      const batch = db.batch();

      updates.forEach(({ userId, data }) => {
        const userRef = this.collection.doc(userId);
        batch.update(userRef, {
          ...data,
          updated_at: firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }
}

export default new UserService();