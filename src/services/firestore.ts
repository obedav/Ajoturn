import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from '../config/firebase';

export interface SavingsGroup {
  id: string;
  name: string;
  description: string;
  adminId: string;
  members: GroupMember[];
  contributionAmount: number;
  contributionFrequency: 'daily' | 'weekly' | 'monthly';
  payoutSchedule: 'weekly' | 'monthly';
  status: 'active' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  currentCycle: number;
  totalCycles: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  joinedAt: Date;
  role: 'admin' | 'member';
  isActive: boolean;
  totalContributions: number;
  missedPayments: number;
}

export interface Contribution {
  id: string;
  groupId: string;
  userId: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: 'pending' | 'paid' | 'overdue';
  paymentMethod?: string;
  transactionId?: string;
  cycle: number;
  createdAt: Date;
}

export interface Payout {
  id: string;
  groupId: string;
  recipientId: string;
  amount: number;
  cycle: number;
  status: 'pending' | 'paid' | 'processing';
  scheduledDate: Date;
  paidDate?: Date;
  transactionId?: string;
  createdAt: Date;
}

class FirestoreService {
  // Savings Groups
  async createSavingsGroup(groupData: Omit<SavingsGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const docRef = await db.collection('savingsGroups').add({
        ...groupData,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating savings group:', error);
      return null;
    }
  }

  async getSavingsGroup(groupId: string): Promise<SavingsGroup | null> {
    try {
      const doc = await db.collection('savingsGroups').doc(groupId).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as SavingsGroup;
      }
      return null;
    } catch (error) {
      console.error('Error fetching savings group:', error);
      return null;
    }
  }

  async getUserGroups(userId: string): Promise<SavingsGroup[]> {
    try {
      const snapshot = await db.collection('savingsGroups')
        .where('members', 'array-contains', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavingsGroup[];
    } catch (error) {
      console.error('Error fetching user groups:', error);
      return [];
    }
  }

  async joinSavingsGroup(groupId: string, userId: string, displayName: string): Promise<boolean> {
    try {
      const newMember: GroupMember = {
        userId,
        displayName,
        joinedAt: new Date(),
        role: 'member',
        isActive: true,
        totalContributions: 0,
        missedPayments: 0,
      };

      await db.collection('savingsGroups').doc(groupId).update({
        members: firestore.FieldValue.arrayUnion(newMember),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      return true;
    } catch (error) {
      console.error('Error joining savings group:', error);
      return false;
    }
  }

  async leaveSavingsGroup(groupId: string, userId: string): Promise<boolean> {
    try {
      const group = await this.getSavingsGroup(groupId);
      if (!group) return false;

      const updatedMembers = group.members.map(member => 
        member.userId === userId ? { ...member, isActive: false } : member
      );

      await db.collection('savingsGroups').doc(groupId).update({
        members: updatedMembers,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      return true;
    } catch (error) {
      console.error('Error leaving savings group:', error);
      return false;
    }
  }

  // Contributions
  async createContribution(contributionData: Omit<Contribution, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      const docRef = await db.collection('contributions').add({
        ...contributionData,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating contribution:', error);
      return null;
    }
  }

  async updateContribution(contributionId: string, updates: Partial<Contribution>): Promise<boolean> {
    try {
      await db.collection('contributions').doc(contributionId).update(updates);
      return true;
    } catch (error) {
      console.error('Error updating contribution:', error);
      return false;
    }
  }

  async getUserContributions(userId: string, groupId?: string): Promise<Contribution[]> {
    try {
      let query = db.collection('contributions').where('userId', '==', userId);
      
      if (groupId) {
        query = query.where('groupId', '==', groupId);
      }
      
      const snapshot = await query.orderBy('dueDate', 'desc').get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contribution[];
    } catch (error) {
      console.error('Error fetching user contributions:', error);
      return [];
    }
  }

  async getGroupContributions(groupId: string, cycle?: number): Promise<Contribution[]> {
    try {
      let query = db.collection('contributions').where('groupId', '==', groupId);
      
      if (cycle) {
        query = query.where('cycle', '==', cycle);
      }
      
      const snapshot = await query.orderBy('dueDate', 'desc').get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contribution[];
    } catch (error) {
      console.error('Error fetching group contributions:', error);
      return [];
    }
  }

  // Payouts
  async createPayout(payoutData: Omit<Payout, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      const docRef = await db.collection('payouts').add({
        ...payoutData,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating payout:', error);
      return null;
    }
  }

  async updatePayout(payoutId: string, updates: Partial<Payout>): Promise<boolean> {
    try {
      await db.collection('payouts').doc(payoutId).update(updates);
      return true;
    } catch (error) {
      console.error('Error updating payout:', error);
      return false;
    }
  }

  async getUserPayouts(userId: string): Promise<Payout[]> {
    try {
      const snapshot = await db.collection('payouts')
        .where('recipientId', '==', userId)
        .orderBy('scheduledDate', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payout[];
    } catch (error) {
      console.error('Error fetching user payouts:', error);
      return [];
    }
  }

  async getGroupPayouts(groupId: string): Promise<Payout[]> {
    try {
      const snapshot = await db.collection('payouts')
        .where('groupId', '==', groupId)
        .orderBy('scheduledDate', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payout[];
    } catch (error) {
      console.error('Error fetching group payouts:', error);
      return [];
    }
  }

  // Real-time listeners
  onGroupUpdates(groupId: string, callback: (group: SavingsGroup | null) => void) {
    return db.collection('savingsGroups').doc(groupId).onSnapshot(
      (doc) => {
        if (doc.exists) {
          callback({ id: doc.id, ...doc.data() } as SavingsGroup);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to group updates:', error);
        callback(null);
      }
    );
  }

  onUserContributionsUpdates(userId: string, groupId: string, callback: (contributions: Contribution[]) => void) {
    return db.collection('contributions')
      .where('userId', '==', userId)
      .where('groupId', '==', groupId)
      .orderBy('dueDate', 'desc')
      .onSnapshot(
        (snapshot) => {
          const contributions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Contribution[];
          callback(contributions);
        },
        (error) => {
          console.error('Error listening to contributions updates:', error);
          callback([]);
        }
      );
  }

  // Utility functions
  async getCollectionCount(collectionName: string, whereClause?: [string, FirebaseFirestoreTypes.WhereFilterOp, any]): Promise<number> {
    try {
      let query = db.collection(collectionName);
      
      if (whereClause) {
        query = query.where(whereClause[0], whereClause[1], whereClause[2]);
      }
      
      const snapshot = await query.get();
      return snapshot.size;
    } catch (error) {
      console.error('Error getting collection count:', error);
      return 0;
    }
  }

  async batchUpdate(updates: { collection: string; docId: string; data: any }[]): Promise<boolean> {
    try {
      const batch = db.batch();
      
      updates.forEach(update => {
        const docRef = db.collection(update.collection).doc(update.docId);
        batch.update(docRef, update.data);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error performing batch update:', error);
      return false;
    }
  }
}

export default new FirestoreService();