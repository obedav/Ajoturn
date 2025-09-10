import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Payout, 
  DatabaseResult, 
  PaginatedResult, 
  QueryOptions, 
  FilterOptions 
} from '../../types/database';

class PayoutService {
  private collection = db.collection('payouts');

  // Create a new payout
  async createPayout(
    payoutData: Omit<Payout, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DatabaseResult<Payout>> {
    try {
      // Check if payout already exists for this recipient and cycle
      const existingSnapshot = await this.collection
        .where('recipient_id', '==', payoutData.recipient_id)
        .where('group_id', '==', payoutData.group_id)
        .where('cycle_number', '==', payoutData.cycle_number)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        return {
          success: false,
          error: 'Payout already exists for this recipient in this cycle',
        };
      }

      const payoutDoc: Omit<Payout, 'id'> = {
        ...payoutData,
        created_at: new Date(),
        updated_at: new Date(),
        
        // Set default values
        approved_by_admin: false,
        retry_count: 0,
        max_retries: payoutData.max_retries || 3,
        net_amount: payoutData.net_amount || payoutData.amount, // Default to full amount
      };

      const docRef = await this.collection.add({
        ...payoutDoc,
        created_at: firestore.FieldValue.serverTimestamp(),
        updated_at: firestore.FieldValue.serverTimestamp(),
        scheduled_date: firestore.Timestamp.fromDate(payoutDoc.scheduled_date),
        processed_date: payoutDoc.processed_date ? firestore.Timestamp.fromDate(payoutDoc.processed_date) : null,
        completed_date: payoutDoc.completed_date ? firestore.Timestamp.fromDate(payoutDoc.completed_date) : null,
        approval_date: payoutDoc.approval_date ? firestore.Timestamp.fromDate(payoutDoc.approval_date) : null,
      });

      const createdPayout: Payout = {
        id: docRef.id,
        ...payoutDoc,
      };

      return {
        success: true,
        data: createdPayout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get payout by ID
  async getPayoutById(payoutId: string): Promise<DatabaseResult<Payout | null>> {
    try {
      const doc = await this.collection.doc(payoutId).get();
      
      if (!doc.exists) {
        return {
          success: true,
          data: null,
        };
      }

      const payoutData = doc.data() as any;
      const payout: Payout = {
        id: doc.id,
        ...payoutData,
        created_at: payoutData.created_at?.toDate?.() || new Date(),
        updated_at: payoutData.updated_at?.toDate?.() || new Date(),
        scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
        processed_date: payoutData.processed_date?.toDate?.(),
        completed_date: payoutData.completed_date?.toDate?.(),
        approval_date: payoutData.approval_date?.toDate?.(),
      };

      return {
        success: true,
        data: payout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update payout
  async updatePayout(
    payoutId: string,
    updates: Partial<Omit<Payout, 'id' | 'created_at'>>
  ): Promise<DatabaseResult<Payout>> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      // Convert date fields
      if (updates.scheduled_date) {
        updateData.scheduled_date = firestore.Timestamp.fromDate(updates.scheduled_date);
      }
      if (updates.processed_date) {
        updateData.processed_date = firestore.Timestamp.fromDate(updates.processed_date);
      }
      if (updates.completed_date) {
        updateData.completed_date = firestore.Timestamp.fromDate(updates.completed_date);
      }
      if (updates.approval_date) {
        updateData.approval_date = firestore.Timestamp.fromDate(updates.approval_date);
      }

      await this.collection.doc(payoutId).update(updateData);
      
      // Get updated payout
      const result = await this.getPayoutById(payoutId);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Approve payout
  async approvePayout(
    payoutId: string,
    adminId: string,
    adminNotes?: string
  ): Promise<DatabaseResult<Payout>> {
    try {
      const payoutResult = await this.getPayoutById(payoutId);
      if (!payoutResult.success || !payoutResult.data) {
        return {
          success: false,
          error: 'Payout not found',
        };
      }

      const payout = payoutResult.data;

      // Verify admin permission
      const groupDoc = await db.collection('groups').doc(payout.group_id).get();
      if (!groupDoc.exists || groupDoc.data()?.admin_id !== adminId) {
        return {
          success: false,
          error: 'Only group admin can approve payouts',
        };
      }

      return await this.updatePayout(payoutId, {
        approved_by_admin: true,
        approval_date: new Date(),
        admin_notes: adminNotes,
        status: 'processing',
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Mark payout as processing
  async markAsProcessing(
    payoutId: string,
    transactionReference?: string
  ): Promise<DatabaseResult<Payout>> {
    try {
      return await this.updatePayout(payoutId, {
        status: 'processing',
        processed_date: new Date(),
        transaction_reference: transactionReference,
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Mark payout as completed
  async markAsCompleted(
    payoutId: string,
    transactionDetails: {
      external_transaction_id?: string;
      completed_date?: Date;
    }
  ): Promise<DatabaseResult<Payout>> {
    try {
      const payoutResult = await this.getPayoutById(payoutId);
      if (!payoutResult.success || !payoutResult.data) {
        return {
          success: false,
          error: 'Payout not found',
        };
      }

      const payout = payoutResult.data;

      const result = await this.updatePayout(payoutId, {
        status: 'completed',
        completed_date: transactionDetails.completed_date || new Date(),
        external_transaction_id: transactionDetails.external_transaction_id,
      });

      if (result.success) {
        // Mark member as having received payout
        await this.updateMemberPayoutStatus(payout.recipient_id, payout.group_id, payout.cycle_number);
        
        // Update group statistics
        await this.updateGroupPayoutStats(payout.group_id, payout.net_amount);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Mark payout as failed
  async markAsFailed(
    payoutId: string,
    failureReason: string,
    shouldRetry: boolean = true
  ): Promise<DatabaseResult<Payout>> {
    try {
      const payoutResult = await this.getPayoutById(payoutId);
      if (!payoutResult.success || !payoutResult.data) {
        return {
          success: false,
          error: 'Payout not found',
        };
      }

      const payout = payoutResult.data;
      const newRetryCount = payout.retry_count + 1;

      const updates: Partial<Payout> = {
        failure_reason: failureReason,
        retry_count: newRetryCount,
      };

      // Determine if we should retry or mark as failed
      if (shouldRetry && newRetryCount < payout.max_retries) {
        updates.status = 'scheduled'; // Retry
        updates.scheduled_date = new Date(Date.now() + 24 * 60 * 60 * 1000); // Retry tomorrow
      } else {
        updates.status = 'failed';
      }

      return await this.updatePayout(payoutId, updates);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get payouts for a user (recipient)
  async getUserPayouts(
    userId: string,
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<Payout>>> {
    try {
      const { limit = 20, offset = 0, order_by = 'scheduled_date', order_direction = 'desc' } = options;
      
      let query = this.collection
        .where('recipient_id', '==', userId)
        .limit(limit + 1)
        .offset(offset);

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.group_id) {
        query = query.where('group_id', '==', filters.group_id);
      }
      if (filters.date_from && filters.date_to) {
        query = query
          .where('scheduled_date', '>=', firestore.Timestamp.fromDate(filters.date_from))
          .where('scheduled_date', '<=', firestore.Timestamp.fromDate(filters.date_to));
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const payouts: Payout[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const payoutData = doc.data() as any;
        payouts.push({
          id: doc.id,
          ...payoutData,
          created_at: payoutData.created_at?.toDate?.() || new Date(),
          updated_at: payoutData.updated_at?.toDate?.() || new Date(),
          scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
          processed_date: payoutData.processed_date?.toDate?.(),
          completed_date: payoutData.completed_date?.toDate?.(),
          approval_date: payoutData.approval_date?.toDate?.(),
        });
      });

      return {
        success: true,
        data: {
          items: payouts,
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

  // Get payouts for a group
  async getGroupPayouts(
    groupId: string,
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<Payout>>> {
    try {
      const { limit = 50, offset = 0, order_by = 'cycle_number', order_direction = 'desc' } = options;
      
      let query = this.collection
        .where('group_id', '==', groupId)
        .limit(limit + 1)
        .offset(offset);

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.user_id) {
        query = query.where('recipient_id', '==', filters.user_id);
      }
      if (filters.date_from && filters.date_to) {
        query = query
          .where('scheduled_date', '>=', firestore.Timestamp.fromDate(filters.date_from))
          .where('scheduled_date', '<=', firestore.Timestamp.fromDate(filters.date_to));
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const payouts: Payout[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const payoutData = doc.data() as any;
        payouts.push({
          id: doc.id,
          ...payoutData,
          created_at: payoutData.created_at?.toDate?.() || new Date(),
          updated_at: payoutData.updated_at?.toDate?.() || new Date(),
          scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
          processed_date: payoutData.processed_date?.toDate?.(),
          completed_date: payoutData.completed_date?.toDate?.(),
          approval_date: payoutData.approval_date?.toDate?.(),
        });
      });

      return {
        success: true,
        data: {
          items: payouts,
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

  // Get payout for specific cycle
  async getCyclePayout(
    groupId: string,
    cycleNumber: number
  ): Promise<DatabaseResult<Payout | null>> {
    try {
      const snapshot = await this.collection
        .where('group_id', '==', groupId)
        .where('cycle_number', '==', cycleNumber)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return {
          success: true,
          data: null,
        };
      }

      const doc = snapshot.docs[0];
      const payoutData = doc.data() as any;
      const payout: Payout = {
        id: doc.id,
        ...payoutData,
        created_at: payoutData.created_at?.toDate?.() || new Date(),
        updated_at: payoutData.updated_at?.toDate?.() || new Date(),
        scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
        processed_date: payoutData.processed_date?.toDate?.(),
        completed_date: payoutData.completed_date?.toDate?.(),
        approval_date: payoutData.approval_date?.toDate?.(),
      };

      return {
        success: true,
        data: payout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get pending payouts (scheduled but not processed)
  async getPendingPayouts(
    daysFromNow: number = 7
  ): Promise<DatabaseResult<Payout[]>> {
    try {
      const fromDate = new Date();
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + daysFromNow);

      const snapshot = await this.collection
        .where('status', '==', 'scheduled')
        .where('approved_by_admin', '==', true)
        .where('scheduled_date', '>=', firestore.Timestamp.fromDate(fromDate))
        .where('scheduled_date', '<=', firestore.Timestamp.fromDate(toDate))
        .orderBy('scheduled_date', 'asc')
        .get();

      const payouts: Payout[] = snapshot.docs.map(doc => {
        const payoutData = doc.data() as any;
        return {
          id: doc.id,
          ...payoutData,
          created_at: payoutData.created_at?.toDate?.() || new Date(),
          updated_at: payoutData.updated_at?.toDate?.() || new Date(),
          scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
          processed_date: payoutData.processed_date?.toDate?.(),
          completed_date: payoutData.completed_date?.toDate?.(),
          approval_date: payoutData.approval_date?.toDate?.(),
        };
      });

      return {
        success: true,
        data: payouts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get payouts awaiting approval
  async getPayoutsAwaitingApproval(): Promise<DatabaseResult<Payout[]>> {
    try {
      const snapshot = await this.collection
        .where('status', '==', 'scheduled')
        .where('approved_by_admin', '==', false)
        .orderBy('scheduled_date', 'asc')
        .get();

      const payouts: Payout[] = snapshot.docs.map(doc => {
        const payoutData = doc.data() as any;
        return {
          id: doc.id,
          ...payoutData,
          created_at: payoutData.created_at?.toDate?.() || new Date(),
          updated_at: payoutData.updated_at?.toDate?.() || new Date(),
          scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
          processed_date: payoutData.processed_date?.toDate?.(),
          completed_date: payoutData.completed_date?.toDate?.(),
          approval_date: payoutData.approval_date?.toDate?.(),
        };
      });

      return {
        success: true,
        data: payouts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Delete payout
  async deletePayout(payoutId: string, adminId?: string): Promise<DatabaseResult<boolean>> {
    try {
      if (adminId) {
        const payoutResult = await this.getPayoutById(payoutId);
        if (!payoutResult.success || !payoutResult.data) {
          return {
            success: false,
            error: 'Payout not found',
          };
        }

        const payout = payoutResult.data;

        // Verify admin permission
        const groupDoc = await db.collection('groups').doc(payout.group_id).get();
        if (!groupDoc.exists || groupDoc.data()?.admin_id !== adminId) {
          return {
            success: false,
            error: 'Only group admin can delete payouts',
          };
        }

        // Don't allow deletion of completed payouts
        if (payout.status === 'completed') {
          return {
            success: false,
            error: 'Cannot delete completed payouts',
          };
        }
      }

      await this.collection.doc(payoutId).delete();

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

  // Real-time listener for user payouts
  onUserPayoutsUpdates(
    userId: string, 
    callback: (payouts: Payout[]) => void
  ): () => void {
    return this.collection
      .where('recipient_id', '==', userId)
      .orderBy('scheduled_date', 'desc')
      .onSnapshot(
        (snapshot) => {
          const payouts: Payout[] = snapshot.docs.map(doc => {
            const payoutData = doc.data() as any;
            return {
              id: doc.id,
              ...payoutData,
              created_at: payoutData.created_at?.toDate?.() || new Date(),
              updated_at: payoutData.updated_at?.toDate?.() || new Date(),
              scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
              processed_date: payoutData.processed_date?.toDate?.(),
              completed_date: payoutData.completed_date?.toDate?.(),
              approval_date: payoutData.approval_date?.toDate?.(),
            };
          });
          callback(payouts);
        },
        (error) => {
          console.error('Error listening to payouts updates:', error);
          callback([]);
        }
      );
  }

  // Real-time listener for group payouts
  onGroupPayoutsUpdates(
    groupId: string, 
    callback: (payouts: Payout[]) => void
  ): () => void {
    return this.collection
      .where('group_id', '==', groupId)
      .orderBy('cycle_number', 'desc')
      .onSnapshot(
        (snapshot) => {
          const payouts: Payout[] = snapshot.docs.map(doc => {
            const payoutData = doc.data() as any;
            return {
              id: doc.id,
              ...payoutData,
              created_at: payoutData.created_at?.toDate?.() || new Date(),
              updated_at: payoutData.updated_at?.toDate?.() || new Date(),
              scheduled_date: payoutData.scheduled_date?.toDate?.() || new Date(),
              processed_date: payoutData.processed_date?.toDate?.(),
              completed_date: payoutData.completed_date?.toDate?.(),
              approval_date: payoutData.approval_date?.toDate?.(),
            };
          });
          callback(payouts);
        },
        (error) => {
          console.error('Error listening to group payouts updates:', error);
          callback([]);
        }
      );
  }

  // Update member payout status
  private async updateMemberPayoutStatus(
    userId: string, 
    groupId: string, 
    cycleNumber: number
  ): Promise<void> {
    try {
      const memberSnapshot = await db.collection('group_members')
        .where('user_id', '==', userId)
        .where('group_id', '==', groupId)
        .limit(1)
        .get();

      if (!memberSnapshot.empty) {
        const memberDoc = memberSnapshot.docs[0];
        await memberDoc.ref.update({
          payout_received: true,
          payout_cycle: cycleNumber,
          payout_date: firestore.FieldValue.serverTimestamp(),
          updated_at: firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating member payout status:', error);
    }
  }

  // Update group payout statistics
  private async updateGroupPayoutStats(groupId: string, amount: number): Promise<void> {
    try {
      await db.collection('groups').doc(groupId).update({
        total_payouts_made: firestore.FieldValue.increment(amount),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating group payout stats:', error);
    }
  }
}

export default new PayoutService();