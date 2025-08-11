import { GitHubInstallation } from '../types/installation.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Simple file-based storage for installations
 */
export class InstallationStore {
  private storePath: string;
  private installations: Map<string, GitHubInstallation> = new Map();

  constructor(storePath = './data/installations.json') {
    this.storePath = storePath;
    this.loadInstallations();
  }

  private loadInstallations(): void {
    try {
      if (existsSync(this.storePath)) {
        const data = readFileSync(this.storePath, 'utf-8');
        const installations = JSON.parse(data);
        this.installations = new Map(Object.entries(installations));
      }
    } catch (error) {
      console.error('Failed to load installations:', error);
    }
  }

  private saveInstallations(): void {
    try {
      const data = Object.fromEntries(this.installations);
      writeFileSync(this.storePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save installations:', error);
    }
  }

  /**
   * Store a new installation
   */
  async storeInstallation(installation: GitHubInstallation): Promise<void> {
    this.installations.set(installation.id, installation);
    this.saveInstallations();
  }

  /**
   * Get installation by ID
   */
  async getInstallation(id: string): Promise<GitHubInstallation | null> {
    return this.installations.get(id) || null;
  }

  /**
   * Get installation by GitHub user ID
   */
  async getInstallationByUserId(userId: number): Promise<GitHubInstallation | null> {
    for (const installation of this.installations.values()) {
      if (installation.githubUserId === userId) {
        return installation;
      }
    }
    return null;
  }

  /**
   * Get installation by repository ID
   */
  async getInstallationByRepositoryId(repositoryId: number): Promise<GitHubInstallation | null> {
    let matchingInstallations: GitHubInstallation[] = [];
    
    for (const installation of this.installations.values()) {
      if (installation.repositoryId === repositoryId) {
        matchingInstallations.push(installation);
      }
      // Check repositories array for GitHub App installations
      if (installation.repositories) {
        for (const repo of installation.repositories) {
          if (repo.id === repositoryId) {
            matchingInstallations.push(installation);
            break; // Don't add the same installation twice
          }
        }
      }
    }
    
    if (matchingInstallations.length === 0) {
      return null;
    }
    
    // Return the most recent installation
    return matchingInstallations.sort((a, b) => 
      new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime()
    )[0];
  }

  /**
   * Update installation
   */
  async updateInstallation(id: string, updates: Partial<GitHubInstallation>): Promise<void> {
    const existing = this.installations.get(id);
    if (existing) {
      this.installations.set(id, { ...existing, ...updates });
      this.saveInstallations();
    }
  }

  /**
   * Remove installation
   */
  async removeInstallation(id: string): Promise<void> {
    this.installations.delete(id);
    this.saveInstallations();
  }

  /**
   * List all installations
   */
  async listInstallations(): Promise<GitHubInstallation[]> {
    return Array.from(this.installations.values());
  }
}
