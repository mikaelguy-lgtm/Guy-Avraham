import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin';
import { db } from '../db';
import { users, clients, lenderUsers, lenderSubmissions } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  firebaseUser?: any;
  dbUser?: any;
}

// 1. requireFirebaseAuth
export async function requireFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'חסר אסימון אבטחה (Token)' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decodedToken;
    next();
  } catch (error: any) {
    console.error('Firebase Auth Middleware error:', error);
    return res.status(401).json({ error: 'אסימון אבטחה פג תוקף או שגוי' });
  }
}

// 2. loadDatabaseUser
export async function loadDatabaseUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({ error: 'נדרש אימות קודם' });
    }
    const firebaseUid = req.firebaseUser.uid;
    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    
    if (!dbUser) {
      // User has a valid Firebase token but is not in PostgreSQL yet
      // This is expected during signup synchronization, so we let it proceed
      return next();
    }
    
    req.dbUser = dbUser;
    next();
  } catch (error: any) {
    console.error('loadDatabaseUser error:', error);
    return res.status(500).json({ error: 'שגיאה בטעינת משתמש ממסד הנתונים' });
  }
}

// 3. requireActiveUser
export function requireActiveUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.dbUser) {
    return res.status(403).json({ error: 'חשבון משתמש לא נמצא במסד הנתונים' });
  }
  
  const validRoles = ['LENDER_ADMIN', 'LENDER_UNDERWRITER', 'SUPER_ADMIN', 'ADMIN', 'ADVISOR'];
  if (!validRoles.includes(req.dbUser.role)) {
    return res.status(403).json({ error: 'תפקיד משתמש אינו תקין או שאינו מורשה במערכת' });
  }
  
  const status = req.dbUser.status;
  if (status === 'SUSPENDED') {
    return res.status(403).json({ error: 'חשבונך מושעה. אנא פנה למנהל המערכת.' });
  }
  if (status === 'DISABLED' || status === 'DELETED') {
    return res.status(403).json({ error: 'חשבונך מבוטל או נמחק.' });
  }
  if (status === 'PENDING') {
    return res.status(403).json({ error: 'חשבונך ממתין לאישור מנהל.' });
  }
  
  next();
}

// 4. requireRole
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(403).json({ error: 'נדרשת כניסה למערכת' });
    }
    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: 'אין לך הרשאה מתאימה לביצוע פעולה זו' });
    }
    next();
  };
}

// 5. requireAdmin (shortcut)
export const requireAdmin = requireRole(['SUPER_ADMIN', 'ADMIN']);

// 6. requireAdvisorClientAccess
export async function requireAdvisorClientAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.dbUser) {
      return res.status(403).json({ error: 'נדרשת כניסה למערכת' });
    }
    
    const clientIdStr = req.params.id || req.body.clientId;
    if (!clientIdStr) {
      return res.status(400).json({ error: 'מזהה לקוח חסר' });
    }
    
    const clientId = parseInt(clientIdStr, 10);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'מזהה לקוח אינו תקין' });
    }
    
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) {
      return res.status(404).json({ error: 'הלקוח לא נמצא' });
    }
    
    // Super admins & admins can access any client
    if (['SUPER_ADMIN', 'ADMIN'].includes(req.dbUser.role)) {
      return next();
    }
    
    // Advisors can only access their own clients
    if (req.dbUser.role === 'ADVISOR') {
      if (client.advisorId !== req.dbUser.id) {
        return res.status(403).json({ error: 'אין לך הרשאה לגשת ללקוח זה' });
      }
      return next();
    }
    
    return res.status(403).json({ error: 'אין לך הרשאה לגשת ללקוח זה' });
  } catch (error: any) {
    console.error('requireAdvisorClientAccess error:', error);
    return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות לקוח' });
  }
}

// 7. requireLenderSubmissionAccess
export async function requireLenderSubmissionAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.dbUser) {
      return res.status(403).json({ error: 'נדרשת כניסה למערכת' });
    }
    
    const submissionIdStr = req.params.id;
    let loadedSub: any = null;
    if (submissionIdStr) {
      const submissionId = parseInt(submissionIdStr, 10);
      if (!isNaN(submissionId)) {
        const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, submissionId)).limit(1);
        if (!sub) {
          return res.status(404).json({ error: 'ההגשה המבוקשת לא נמצאה' });
        }
        loadedSub = sub;
        (req as any).authorizedSubmission = sub;
      }
    }

    // Super admins and admins can view any submission
    if (['SUPER_ADMIN', 'ADMIN'].includes(req.dbUser.role)) {
      return next();
    }
    
    // Lender admins and underwriters must belong to the lender that owns the submission
    if (['LENDER_ADMIN', 'LENDER_UNDERWRITER'].includes(req.dbUser.role)) {
      const [lenderUser] = await db.select().from(lenderUsers).where(eq(lenderUsers.userId, req.dbUser.id)).limit(1);
      if (!lenderUser) {
        return res.status(403).json({ error: 'אינך משויך לגוף מימון מורשה' });
      }
      
      if (loadedSub && loadedSub.lenderId !== lenderUser.lenderId) {
        return res.status(403).json({ error: 'אין לגוף המימון שלך הרשאה לגשת לבקשה זו' });
      }

      req.body.lenderId = lenderUser.lenderId; // Enforce correct lender ID context
      return next();
    }
    
    return res.status(403).json({ error: 'אין לך הרשאה לפעולה זו' });
  } catch (error: any) {
    console.error('requireLenderSubmissionAccess error:', error);
    return res.status(500).json({ error: 'שגיאה בבדיקת הרשאות חתם' });
  }
}
