import { db } from "../db";
import { systemSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { getSecret } from "./secretManager";

// Memory cache for non-secrets
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10000; // 10 seconds short-lived cache

/**
 * Clean memory cache
 */
export function clearSettingsCache() {
  cache.clear();
  console.log("[SettingsService] Cache cleared.");
}

/**
 * Load a system setting by key, resolving secrets from Secret Manager
 */
export async function getSetting(key: string, defaultValue: string = ""): Promise<string> {
  const now = Date.now();
  
  // 1. Check cache first for non-secrets
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    // 2. Query from database
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    
    if (row) {
      if (row.isSecret) {
        // Resolve from Secret Manager
        const secretVal = await getSecret(row.value || "");
        return secretVal || defaultValue;
      } else {
        // Cache non-secret values
        const val = row.value !== null ? row.value : defaultValue;
        cache.set(key, { value: val, expiresAt: now + CACHE_TTL_MS });
        return val;
      }
    }
  } catch (error) {
    console.error(`[SettingsService] Failed to fetch setting '${key}' from database:`, error);
  }

  // 3. Fall back to process.env or default
  const envVal = process.env[key];
  if (envVal !== undefined) {
    return envVal;
  }

  return defaultValue;
}

/**
 * Update or insert a system setting
 */
export async function setSetting(
  key: string,
  value: string,
  category: string = "GENERAL",
  updatedByUserId?: number,
  isSecret: boolean = false,
  description?: string
): Promise<void> {
  try {
    const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    
    if (existing) {
      await db.update(systemSettings).set({
        value: isSecret ? existing.value : value, // Secrets are updated via SecretManager directly, DB holds only reference
        category,
        isSecret,
        description: description || existing.description,
        updatedByUserId: updatedByUserId || null,
        updatedAt: new Date()
      }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({
        key,
        value,
        category,
        isSecret,
        description: description || "",
        updatedByUserId: updatedByUserId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Evict cache
    cache.delete(key);
  } catch (error) {
    console.error(`[SettingsService] Failed to set setting '${key}':`, error);
    throw error;
  }
}
