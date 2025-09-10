import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SavingsGroup, Contribution } from '../services/firestore';
import FirestoreService from '../services/firestore';
import { useAuth } from './AuthContext';

interface GroupContextType {
  groups: SavingsGroup[];
  currentGroup: SavingsGroup | null;
  loading: boolean;
  refreshGroups: () => Promise<void>;
  setCurrentGroup: (group: SavingsGroup | null) => void;
  createGroup: (groupData: Omit<SavingsGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  joinGroup: (groupId: string, displayName: string) => Promise<boolean>;
  leaveGroup: (groupId: string) => Promise<boolean>;
}

const GroupContext = createContext<GroupContextType>({
  groups: [],
  currentGroup: null,
  loading: false,
  refreshGroups: async () => {},
  setCurrentGroup: () => {},
  createGroup: async () => null,
  joinGroup: async () => false,
  leaveGroup: async () => false,
});

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
};

interface GroupProviderProps {
  children: ReactNode;
}

export const GroupProvider: React.FC<GroupProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<SavingsGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<SavingsGroup | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshGroups = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userGroups = await FirestoreService.getUserGroups(user.uid);
      setGroups(userGroups);
    } catch (error) {
      console.error('Error refreshing groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (groupData: Omit<SavingsGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    if (!user) return null;
    
    try {
      setLoading(true);
      const groupId = await FirestoreService.createSavingsGroup({
        ...groupData,
        adminId: user.uid,
      });
      
      if (groupId) {
        await refreshGroups();
      }
      
      return groupId;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (groupId: string, displayName: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      setLoading(true);
      const success = await FirestoreService.joinSavingsGroup(
        groupId, 
        user.uid, 
        displayName || user.displayName || 'Unknown User'
      );
      
      if (success) {
        await refreshGroups();
      }
      
      return success;
    } catch (error) {
      console.error('Error joining group:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async (groupId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      setLoading(true);
      const success = await FirestoreService.leaveSavingsGroup(groupId, user.uid);
      
      if (success) {
        await refreshGroups();
        if (currentGroup?.id === groupId) {
          setCurrentGroup(null);
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error leaving group:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshGroups();
    } else {
      setGroups([]);
      setCurrentGroup(null);
    }
  }, [user]);

  const value: GroupContextType = {
    groups,
    currentGroup,
    loading,
    refreshGroups,
    setCurrentGroup,
    createGroup,
    joinGroup,
    leaveGroup,
  };

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  );
};