import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';

interface TokenCacheEntry {
  token: string;
  expires: number;
}

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

const tokenCache = new Map<number, TokenCacheEntry>();

export async function generateAppToken(): Promise<string> {
  if (!process.env.GITHUB_APP_ID) {
    throw new Error('GITHUB_APP_ID environment variable is required');
  }

  // Read private key from environment or file
  let privateKey: string;

  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    const rawKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');

    // Check if the key is base64 encoded
    if (!rawKey.includes('-----BEGIN') && /^[A-Za-z0-9+/]+=*$/.test(rawKey.replace(/\s/g, ''))) {
      try {
        privateKey = Buffer.from(rawKey, 'base64').toString('utf8');
      } catch (error) {
        throw new Error(`Failed to decode base64 private key: ${error}`);
      }
    } else {
      privateKey = rawKey;
    }
  } else {
    // Read from file
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || 'private-key.pem';
    try {
      privateKey = readFileSync(keyPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read private key file at ${keyPath}: ${error}`);
    }
  }

  // Auto-format private key if it's missing PEM headers
  if (!privateKey.includes('-----BEGIN')) {
    const base64Content = privateKey
      .replace(/\s/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '')
      .trim();

    if (!/^[A-Za-z0-9+/]+=*$/.test(base64Content)) {
      throw new Error('Private key content does not appear to be valid base64');
    }

    const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
    privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`;
  }

  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60, // Issued 1 minute ago
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expires in 10 minutes
    iss: process.env.GITHUB_APP_ID,
  };

  try {
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error) {
    throw new Error(`Failed to sign JWT: ${error}`);
  }
}

export async function getInstallationAccessToken(installationId: string, appToken: string): Promise<InstallationTokenResponse> {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Code-Review-Agent/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get installation access token: ${response.status} - ${errorText}`);
  }

  return await response.json() as InstallationTokenResponse;
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expires > Date.now() + 300_000) { // 5 min buffer
    return cached.token;
  }

  try {
    const appJwt = await generateAppToken();
    const response = await getInstallationAccessToken(installationId.toString(), appJwt);

    // Parse expires_at from GitHub API response (returns ISO string like "2024-01-01T12:00:00Z")
    const expires = new Date(response.expires_at).getTime();

    tokenCache.set(installationId, { token: response.token, expires });
    return response.token;
  } catch (error) {
    // Remove from cache on error
    tokenCache.delete(installationId);
    throw error;
  }
}

export function invalidateTokenCache(installationId: number): void {
  tokenCache.delete(installationId);
}
