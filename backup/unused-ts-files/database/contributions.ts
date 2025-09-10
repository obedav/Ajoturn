import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Contribution, 
  DatabaseResult, 
  PaginatedResult, 
  QueryOptions, 
  FilterOptions 
} from '../../types/database';

class ContributionService {
  private collection = db.collection('contributions');

  // Create a new contribution
  async createContribution(
    contributionData: Omit<Contribution, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DatabaseResult<Contribution>> {
    try {
      // Check if contribution already exists for this user, group, and cycle
      const existingSnapshot = await this.collection
        .where('user_id', '==', contributionData.user_id)
        .where('group_id', '==', contributionData.group_id)
        .where('cycle_number', '==', contributionData.cycle_number)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        return {
          success: false,
          error: 'Contribution already exists for this user in this cycle',
        };
      }

      const contributionDoc: Omit<Contribution, 'id'> = {
        ...contributionData,
        created_at: new Date(),
        updated_at: new Date(),
        
        // Set default values
        is_late: this.isLatePayment(contributionData.due_date),
        grace_period_used: false,
        verified_by_admin: false,
      };

      const docRef = await this.collection.add({
        ...contributionDoc,
        created_at: firestore.FieldValue.serverTimestamp(),
        updated_at: firestore.FieldValue.serverTimestamp(),
        due_date: firestore.Timestamp.fromDate(contributionDoc.due_date),
        paid_date: contributionDoc.paid_date ? firestore.Timestamp.fromDate(contributionDoc.paid_date) : null,
      });

      const createdContribution: Contribution = {
        id: docRef.id,
        ...contributionDoc,
      };

      return {
        success: true,
        data: createdContribution,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get contribution by ID
  async getContributionById(contributionId: string): Promise<DatabaseResult<Contribution | null>> {
    try {
      const doc = await this.collection.doc(contributionId).get();
      
      if (!doc.exists) {
        return {
          success: true,
          data: null,
        };
      }

      const contributionData = doc.data() as any;
      const contribution: Contribution = {
        id: doc.id,
        ...contributionData,
        created_at: contributionData.created_at?.toDate?.() || new Date(),
        updated_at: contributionData.updated_at?.toDate?.() || new Date(),
        due_date: contributionData.due_date?.toDate?.() || new Date(),
        paid_date: contributionData.paid_date?.toDate?.(),
        verification_date: contributionData.verification_date?.toDate?.(),
      };

      return {
        success: true,
        data: contribution,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update contribution
  async updateContribution(
    contributionId: string,
    updates: Partial<Omit<Contribution, 'id' | 'created_at'>>
  ): Promise<DatabaseResult<Contribution>> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      // Convert date fields
      if (updates.due_date) {
        updateData.due_date = firestore.Timestamp.fromDate(updates.due_date);
      }
      if (updates.paid_date) {
        updateData.paid_date = firestore.Timestamp.fromDate(updates.paid_date);
      }
      if (updates.verification_date) {
        updateData.verification_date = firestore.Timestamp.fromDate(updates.verification_date);
      }

      await this.collection.doc(contributionId).update(updateData);
      
      // Get updated contribution
      const result = await this.getContributionById(contributionId);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Mark contribution as paid
  async markAsPaid(
    contributionId: string,
    paymentDetails: {
      paid_date?: Date;
      payment_method?: string;
      transaction_reference?: string;
      payment_proof_url?: string;
      payment_proof_type?: string;
    }
  ): Promise<DatabaseResult<Contribution>> {
    try {
      const contributionResult = await this.getContributionById(contributionId);
      if (!contributionResult.success || !contributionResult.data) {
        return {
          success: false,
          error: 'Contribution not found',
        };
      }

      const contribution = contributionResult.data;
      const paidDate = paymentDetails.paid_date || new Date();
      const isLate = this.isLatePayment(contribution.due_date, paidDate);
      
      // Calculate late penalty if applicable
      let latePenalty = 0;
      if (isLate) {
        const groupDoc = await db.collection('groups').doc(contribution.group_id).get();
        if (groupDoc.exists && groupDoc.data()?.late_payment_penalty) {
          latePenalty = groupDoc.data()!.late_payment_penalty;
        }
      }

      const updates = {
        status: 'paid' as const,
        paid_date: paidDate,
        is_late: isLate,
        late_penalty_amount: latePenalty,
        ...paymentDetails,
      };

      const result = await this.updateContribution(contributionId, updates);
      
      if (result.success) {
        // Update member statistics
        await this.updateMemberContributionStats(contribution.user_id, contribution.group_id, {
          contributionMade: true,
          isLate,
          missed: false,
        });

        // Update group statistics
        await this.updateGroupContributionStats(contribution.group_id, contribution.amount + latePenalty);
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

  // Mark contribution as overdue
  async markAsOverdue(contributionId: string): Promise<DatabaseResult<Contribution>> {
    try {
      const contributionResult = await this.getContributionById(contributionId);
      if (!contributionResult.success || !contributionResult.data) {
        return {
          success: false,
          error: 'Contribution not found',
        };
      }

      const contribution = contributionResult.data;

      const result = await this.updateContribution(contributionId, {
        status: 'overdue',
        is_late: true,
      });

      if (result.success) {
        // Update member statistics
        await this.updateMemberContributionStats(contribution.user_id, contribution.group_id, {
          contributionMade: false,
          isLate: false,
          missed: true,
        });
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

  // Verify contribution by admin
  async verifyContribution(
    contributionId: string,
    adminId: string,
    adminNotes?: string
  ): Promise<DatabaseResult<Contribution>> {
    try {
      const contributionResult = await this.getContributionById(contributionId);
      if (!contributionResult.success || !contributionResult.data) {
        return {
          success: false,
          error: 'Contribution not found',
        };
      }

      const contribution = contributionResult.data;

      // Verify admin permission
      const groupDoc = await db.collection('groups').doc(contribution.group_id).get();
      if (!groupDoc.exists || groupDoc.data()?.admin_id !== adminId) {
        return {
          success: false,
          error: 'Only group admin can verify contributions',
        };
      }

      return await this.updateContribution(contributionId, {
        verified_by_admin: true,
        verification_date: new Date(),
        admin_notes: adminNotes,
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get contributions for a user
  async getUserContributions(
    userId: string,
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<Contribution>>> {
    try {
      const { limit = 20, offset = 0, order_by = 'due_date', order_direction = 'desc' } = options;
      
      let query = this.collection
        .where('user_id', '==', userId)
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
          .where('due_date', '>=', firestore.Timestamp.fromDate(filters.date_from))
          .where('due_date', '<=', firestore.Timestamp.fromDate(filters.date_to));
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const contributions: Contribution[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const contributionData = doc.data() as any;
        contributions.push({
          id: doc.id,
          ...contributionData,
          created_at: contributionData.created_at?.toDate?.() || new Date(),
          updated_at: contributionData.updated_at?.toDate?.() || new Date(),
          due_date: contributionData.due_date?.toDate?.() || new Date(),
          paid_date: contributionData.paid_date?.toDate?.(),
          verification_date: contributionData.verification_date?.toDate?.(),
        });
      });

      return {
        success: true,
        data: {
          items: contributions,
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

  // Get contributions for a group
  async getGroupContributions(
    groupId: string,
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<Contribution>>> {
    try {
      const { limit = 50, offset = 0, order_by = 'due_date', order_direction = 'desc' } = options;
      
      let query = this.collection
        .where('group_id', '==', groupId)
        .limit(limit + 1)
        .offset(offset);

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.user_id) {
        query = query.where('user_id', '==', filters.user_id);
      }
      if (filters.date_from && filters.date_to) {
        query = query
          .where('due_date', '>=', firestore.Timestamp.fromDate(filters.date_from))
          .where('due_date', '<=', firestore.Timestamp.fromDate(filters.date_to));
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const contributions: Contribution[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const contributionData = doc.data() as any;
        contributions.push({
          id: doc.id,
          ...contributionData,
          created_at: contributionData.created_at?.toDate?.() || new Date(),
          updated_at: contributionData.updated_at?.toDate?.() || new Date(),
          due_date: contributionData.due_date?.toDate?.() || new Date(),
          paid_date: contributionData.paid_date?.toDate?.(),
          verification_date: contributionData.verification_date?.toDate?.(),
        });
      });

      return {
        success: true,
        data: {
          items: contributions,
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

  // Get contributions for a specific cycle
  async getCycleContributions(
    groupId: string,
    cycleNumber: number
  ): Promise<DatabaseResult<Contribution[]>> {
    try {
      const snapshot = await this.collection
        .where('group_id', '==', groupId)
        .where('cycle_number', '==', cycleNumber)
        .orderBy('due_date', 'asc')
        .get();

      const contributions: Contribution[] = snapshot.docs.map(doc => {
        const contributionData = doc.data() as any;
        return {
          id: doc.id,
          ...contributionData,
          created_at: contributionData.created_at?.toDate?.() || new Date(),
          updated_at: contributionData.updated_at?.toDate?.() || new Date(),
          due_date: contributionData.due_date?.toDate?.() || new Date(),
          paid_date: contributionData.paid_date?.toDate?.(),
          verification_date: contributionData.verification_date?.toDate?.(),
        };
      });

      return {
        success: true,
        data: contributions,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get pending contributions (due soon)
  async getPendingContributions(
    daysFromNow: number = 7
  ): Promise<DatabaseResult<Contribution[]>> {
    try {
      const fromDate = new Date();
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + daysFromNow);

      const snapshot = await this.collection
        .where('status', '==', 'pending')
        .where('due_date', '>=', firestore.Timestamp.fromDate(fromDate))
        .where('due_date', '<=', firestore.Timestamp.fromDate(toDate))
        .orderBy('due_date', 'asc')
        .get();

      const contributions: Contribution[] = snapshot.docs.map(doc => {
        const contributionData = doc.data() as any;
        return {
          id: doc.id,
          ...contributionData,
          created_at: contributionData.created_at?.toDate?.() || new Date(),
          updated_at: contributionData.updated_at?.toDate?.() || new Date(),
          due_date: contributionData.due_date?.toDate?.() || new Date(),
          paid_date: contributionData.paid_date?.toDate?.(),
          verification_date: contributionData.verification_date?.toDate?.(),
        };
      });

      return {
        success: true,
        data: contributions,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get overdue contributions
  async getOverdueContributions(): Promise<DatabaseResult<Contribution[]>> {
    try {
      const now = new Date();

      const snapshot = await this.collection
        .where('status', '==', 'pending')
        .where('due_date', '<', firestore.Timestamp.fromDate(now))
        .orderBy('due_date', 'asc')
        .get();

      const contributions: Contribution[] = snapshot.docs.map(doc => {
        const contributionData = doc.data() as any;
        return {
          id: doc.id,
          ...contributionData,
          created_at: contributionData.created_at?.toDate?.() || new Date(),
          updated_at: contributionData.updated_at?.toDate?.() || new Date(),
          due_date: contributionData.due_date?.toDate?.() || new Date(),
          paid_date: contributionData.paid_date?.toDate?.(),
          verification_date: contributionData.verification_date?.toDate?.(),
        };
      });

      return {
        success: true,
        data: contributions,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Delete contribution
  async deleteContribution(contributionId: string, adminId?: string): Promise<DatabaseResult<boolean>> {
    try {
      if (adminId) {
        const contributionResult = await this.getContributionById(contributionId);
        if (!contributionResult.success || !contributionResult.data) {
          return {
            success: false,
            error: 'Contribution not found',
          };
        }

        const contribution = contributionResult.data;

        // Verify admin permission
        const groupDoc = await db.collection('groups').doc(contribution.group_id).get();
        if (!groupDoc.exists || groupDoc.data()?.admin_id !== adminId) {
          return {
            success: false,
            error: 'Only group admin can delete contributions',
          };
        }
      }

      await this.collection.doc(contributionId).delete();

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

  // Real-time listener for user contributions
  onUserContributionsUpdates(
    userId: string, 
    groupId: string, 
    callback: (contributions: Contribution[]) => void
  ): () => void {
    return this.collection
      .where('user_id', '==', userId)
      .where('group_id', '==', groupId)
      .orderBy('due_date', 'desc')
      .onSnapshot(
        (snapshot) => {
          const contributions: Contribution[] = snapshot.docs.map(doc => {
            const contributionData = doc.data() as any;
            return {
              id: doc.id,
              ...contributionData,
              created_at: contributionData.created_at?.toDate?.() || new Date(),
              updated_at: contributionData.updated_at?.toDate?.() || new Date(),
              due_date: contributionData.due_date?.toDate?.() || new Date(),
              paid_date: contributionData.paid_date?.toDate?.(),
              verification_date: contributionData.verification_date?.toDate?.(),
            };
          });
          callback(contributions);
        },
        (error) => {
          console.error('Error listening to contributions updates:', error);
          callback([]);
        }
      );
  }

  // Batch create contributions for a cycle
  async batchCreateContributions(
    contributions: Array<Omit<Contribution, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<DatabaseResult<boolean>> {
    try {
      const batch = db.batch();

      contributions.forEach(contributionData => {
        const docRef = this.collection.doc();
        const contributionDoc = {
          ...contributionData,
          created_at: firestore.FieldValue.serverTimestamp(),
          updated_at: firestore.FieldValue.serverTimestamp(),
          due_date: firestore.Timestamp.fromDate(contributionData.due_date),
          paid_date: contributionData.paid_date ? firestore.Timestamp.fromDate(contributionData.paid_date) : null,
          is_late: this.isLatePayment(contributionData.due_date),
          grace_period_used: false,
          verified_by_admin: false,
        };
        batch.set(docRef, contributionDoc);
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

  // Helper function to check if payment is late
  private isLatePayment(dueDate: Date, paidDate?: Date): boolean {
    const checkDate = paidDate || new Date();
    return checkDate > dueDate;
  }

  // Update member contribution statistics
  private async updateMemberContributionStats(
    userId: string, 
    groupId: string, 
    stats: {
      contributionMade: boolean;
      isLate: boolean;
      missed: boolean;
    }
  ): Promise<void> {
    try {
      const memberSnapshot = await db.collection('group_members')
        .where('user_id', '==', userId)
        .where('group_id', '==', groupId)
        .limit(1)
        .get();

      if (!memberSnapshot.empty) {
        const memberDoc = memberSnapshot.docs[0];
        const updates: any = {};

        if (stats.contributionMade) {
          updates.total_contributions_made = firestore.FieldValue.increment(1);
          
          if (stats.isLate) {
            updates.late_contributions = firestore.FieldValue.increment(1);
          } else {
            updates.on_time_contributions = firestore.FieldValue.increment(1);
          }
        }

        if (stats.missed) {
          updates.missed_contributions = firestore.FieldValue.increment(1);
        }

        updates.updated_at = firestore.FieldValue.serverTimestamp();

        await memberDoc.ref.update(updates);
      }
    } catch (error) {
      console.error('Error updating member stats:', error);
    }
  }

  // Update group contribution statistics
  private async updateGroupContributionStats(groupId: string, amount: number): Promise<void> {
    try {
      await db.collection('groups').doc(groupId).update({
        total_contributions_collected: firestore.FieldValue.increment(amount),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating group stats:', error);
    }
  }
}

export default new ContributionService();