import type { NextFunction, Request, Response } from "express";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AppEnv } from "../config/env.js";
import type { DatabaseUser, UserRole } from "../domain/types.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      firebaseIdentity?: {uid: string; email?: string; emailVerified: boolean};
      user?: DatabaseUser;
      authorizedClientId?: number;
      authorizedSubmission?: {id: number; lenderId: number; clientId: number; anonymousSnapshot: unknown};
      authorizedLenderUser?: DatabaseUser;
    }
  }
}

export interface TokenVerifier {
  verify(token: string): Promise<{uid: string; email?: string; emailVerified: boolean}>;
}

export interface AuthorizationDirectory {
  findUserByFirebaseUid(uid: string): Promise<DatabaseUser | null>;
  getClientAdvisorId(clientId: number): Promise<number | null>;
  getSubmissionAccess(submissionId: number): Promise<{id: number; lenderId: number; clientId: number; anonymousSnapshot: unknown} | null>;
}

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(env: AppEnv) {
    if (getApps().length === 0) {
      if (env.FIREBASE_AUTH_EMULATOR_HOST) {
        initializeApp({projectId: env.FIREBASE_PROJECT_ID});
      } else {
        initializeApp({
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replaceAll("\\n", "\n")
          })
        });
      }
    }
  }

  async verify(token: string): Promise<{uid: string; email?: string; emailVerified: boolean}> {
    const decoded = await getAuth().verifyIdToken(token, true);
    return {uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified === true};
  }
}

export function createAuthMiddleware(directory: AuthorizationDirectory, verifier: TokenVerifier) {
  const requireFirebaseAuth = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      response.status(401).json({error: "AUTH_REQUIRED", requestId: request.requestId});
      return;
    }
    try {
      request.firebaseIdentity = await verifier.verify(authorization.slice(7));
      next();
    } catch {
      response.status(401).json({error: "INVALID_TOKEN", requestId: request.requestId});
    }
  };

  const loadDatabaseUser = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const user = request.firebaseIdentity ? await directory.findUserByFirebaseUid(request.firebaseIdentity.uid) : null;
    if (!user) {
      response.status(401).json({error: "USER_NOT_FOUND", requestId: request.requestId});
      return;
    }
    request.user = user;
    next();
  };

  const requireActiveUser = (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user || request.user.status !== "ACTIVE" || request.user.deletedAt !== null) {
      response.status(403).json({error: "USER_INACTIVE", requestId: request.requestId});
      return;
    }
    next();
  };

  const requireRole = (...roles: UserRole[]) => (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({error: "FORBIDDEN", requestId: request.requestId});
      return;
    }
    next();
  };

  const requireAdvisorClientAccess = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const clientId = Number(request.params.id ?? request.params.clientId);
    const advisorId = await directory.getClientAdvisorId(clientId);
    if (!request.user || !Number.isInteger(clientId) || advisorId === null) {
      response.status(404).json({error: "CLIENT_NOT_FOUND", requestId: request.requestId});
      return;
    }
    const privileged = request.user.role === "SUPER_ADMIN";
    if (!privileged && (request.user.role !== "ADVISOR" || request.user.advisorId !== advisorId)) {
      response.status(403).json({error: "FORBIDDEN", requestId: request.requestId});
      return;
    }
    request.authorizedClientId = clientId;
    next();
  };

  const requireLenderSubmissionAccess = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const submissionId = Number(request.params.id ?? request.params.submissionId);
    const submission = await directory.getSubmissionAccess(submissionId);
    if (!request.user || !submission) {
      response.status(404).json({error: "SUBMISSION_NOT_FOUND", requestId: request.requestId});
      return;
    }
    if (!request.user.lenderId || request.user.lenderId !== submission.lenderId) {
      response.status(403).json({error: "FORBIDDEN", requestId: request.requestId});
      return;
    }
    request.authorizedSubmission = submission;
    request.authorizedLenderUser = request.user;
    next();
  };

  return {
    requireFirebaseAuth,
    loadDatabaseUser,
    requireActiveUser,
    requireRole,
    requireAdvisorClientAccess,
    requireLenderSubmissionAccess,
    requireAdmin: requireRole("ADMIN", "SUPER_ADMIN"),
    requireSuperAdmin: requireRole("SUPER_ADMIN")
  };
}
