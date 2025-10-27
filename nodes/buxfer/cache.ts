import { FlatCache } from 'flat-cache';
import crypto from 'crypto';
import type { ILoadOptionsFunctions } from 'n8n-workflow';

interface CacheData {
  data: any[];
  timestamp: number;
  credentialHash: string;
}

export class BuxferCache {
  private cache: FlatCache;
  private ttlSeconds: number;
  private nodeVersion: string;

  constructor(nodeVersion: string, ttlMinutes: number = 30) {
    this.nodeVersion = nodeVersion;
    this.ttlSeconds = ttlMinutes * 60;
    // Create cache with version-specific directory and TTL
    this.cache = new FlatCache({
      cacheId: `buxfer-v${nodeVersion}`,
      cacheDir: '.cache',
      ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
    });
  }

  private generateCredentialHash(context: ILoadOptionsFunctions): string {
    try {
      // getCredentials is synchronous in ILoadOptionsFunctions
      const credentials = context.getCredentials('buxferApi');
      const email = (credentials as any)?.email as string || '';
      return crypto.createHash('md5').update(email).digest('hex').substring(0, 8);
    } catch {
      // Fallback to a default hash if credentials can't be accessed
      return 'default';
    }
  }

  private getCacheKey(dataType: 'accounts' | 'tags', credentialHash: string): string {
    return `buxfer-${dataType}-${this.nodeVersion}-${credentialHash}`;
  }

  private isExpired(timestamp: number): boolean {
    const now = Date.now();
    const ageSeconds = (now - timestamp) / 1000;
    return ageSeconds > this.ttlSeconds;
  }

  get<T>(dataType: 'accounts' | 'tags', context: ILoadOptionsFunctions): T[] | null {
    try {
      const credentialHash = this.generateCredentialHash(context);
      const cacheKey = this.getCacheKey(dataType, credentialHash);
      const cached = this.cache.get(cacheKey) as CacheData;

      if (!cached) {
        return null;
      }

      // Check if cache is for same credentials and not expired
      if (cached.credentialHash !== credentialHash || this.isExpired(cached.timestamp)) {
        // Remove expired or mismatched cache entry
        this.cache.delete(cacheKey);
        this.cache.save();
        return null;
      }

      return cached.data as T[];
    } catch {
      // If any error occurs, return null to force fresh fetch
      return null;
    }
  }

  set<T>(dataType: 'accounts' | 'tags', context: ILoadOptionsFunctions, data: T[]): void {
    try {
      const credentialHash = this.generateCredentialHash(context);
      const cacheKey = this.getCacheKey(dataType, credentialHash);

      const cacheData: CacheData = {
        data,
        timestamp: Date.now(),
        credentialHash
      };

      this.cache.set(cacheKey, cacheData);
      this.cache.save();
    } catch (error) {
      // Silently fail - caching is not critical for functionality
      // eslint-disable-next-line no-console
      console.warn('[Buxfer Cache] Failed to save cache:', error);
    }
  }

  clear(dataType?: 'accounts' | 'tags'): void {
    try {
      if (dataType) {
        // Clear specific data type
        const keys = this.cache.keys();
        const pattern = `buxfer-${dataType}-${this.nodeVersion}-`;
        keys.forEach((key: string) => {
          if (key.startsWith(pattern)) {
            this.cache.delete(key);
          }
        });
      } else {
        // Clear all cache
        this.cache.clear();
      }
      this.cache.save();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[Buxfer Cache] Failed to clear cache:', error);
    }
  }
}
