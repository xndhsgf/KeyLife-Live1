import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth, loginWithGoogle, loginWithEmail as firebaseLoginWithEmail, signupWithEmail as firebaseSignupWithEmail, logout as firebaseLogout, db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isProfileComplete: boolean;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (displayName: string, photoURL: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Ensure user document exists in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const docSnap = await getDoc(userRef);
          const isMasterAdmin = currentUser.email === 'admin@cocco.com' || currentUser.email === 'iejehdgdig@gmail.com';
          
          if (!docSnap.exists()) {
            const numericId = Math.floor(1000000 + Math.random() * 9000000).toString();
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || (isMasterAdmin ? 'المدير العام' : 'مستخدم جديد'),
              photoURL: currentUser.photoURL || '',
              diamonds: isMasterAdmin ? 999999 : 0,
              totalSpent: 0,
              totalSupport: 0,
              role: isMasterAdmin ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              numericId: numericId
            });
          } else {
            const data = docSnap.data();
            if (isMasterAdmin && data.role !== 'admin') {
              // Ensure master admin always has admin role
              await setDoc(userRef, { role: 'admin' }, { merge: true });
            }
            if (!data.numericId) {
              const numericId = Math.floor(1000000 + Math.random() * 9000000).toString();
              await setDoc(userRef, { numericId }, { merge: true });
            }
          }

          // Listen to user document to check if profile is complete
          unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              const data = doc.data();
              // Profile is complete if country, gender, and age exist
              setIsProfileComplete(!!(data.country && data.gender && data.age));
            } else {
              setIsProfileComplete(false);
            }
            setLoading(false);
          });

        } catch (error) {
          console.error("Error creating user document:", error);
          setLoading(false);
        }
      } else {
        setIsProfileComplete(false);
        setLoading(false);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await firebaseLoginWithEmail(email, pass);
    } catch (error) {
      throw error;
    }
  };

  const signupWithEmail = async (email: string, pass: string) => {
    try {
      await firebaseSignupWithEmail(email, pass);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await firebaseLogout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateUserProfile = async (displayName: string, photoURL: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName, photoURL });
      await auth.currentUser.reload();
      
      // Update in Firestore
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        await setDoc(userRef, { displayName, photoURL }, { merge: true });

        // If user has a CP partner, update the partner's document with the new name/avatar
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.cpPartnerId) {
            const partnerRef = doc(db, 'users', userData.cpPartnerId);
            await setDoc(partnerRef, {
              cpPartnerName: displayName,
              cpPartnerAvatar: photoURL
            }, { merge: true });
          }
        }
      } catch (error) {
        console.error("Error updating user in Firestore:", error);
      }

      // Force state update to reflect changes immediately by creating a new object with all necessary properties
      setUser({ 
        ...auth.currentUser, 
        uid: auth.currentUser.uid, 
        email: auth.currentUser.email, 
        displayName: displayName, 
        photoURL: photoURL 
      } as any);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isProfileComplete, loading, login, loginWithEmail, signupWithEmail, logout, updateUserProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

