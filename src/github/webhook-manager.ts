export interface WebhookConfig {
  url: string;
  content_type?: string;
  secret?: string;
  insecure_ssl?: string;
  events?: string[];
}

export class WebhookManager {
  private githubBaseUrl: string;

  constructor() {
    this.githubBaseUrl = process.env.GITHUB_BASE_URL || 'https://api.github.com';
  }

  /**
   * Create webhook for a repository
   */
  async createRepositoryWebhook(
    owner: string,
    repo: string,
    accessToken: string,
    webhookConfig: WebhookConfig
  ): Promise<number> {
    const webhookData = {
      config: {
        url: webhookConfig.url,
        content_type: webhookConfig.content_type || 'json',
        secret: webhookConfig.secret,
        insecure_ssl: webhookConfig.insecure_ssl || '0',
      },
      events: webhookConfig.events || ['pull_request'],
      active: true,
    };

    console.log('Creating webhook with config:', webhookData);

    const response = await fetch(
      `${this.githubBaseUrl}/repos/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to create webhook: ${response.status} - ${error}`);
      throw new Error(`Failed to create webhook: ${response.status} - ${error}`);
    }

    const webhook = await response.json();
    console.log('Webhook created successfully:', JSON.stringify(webhook, null, 2));
    return webhook.id;
  }

  /**
   * Create webhook for an organization
   */
  async createOrganizationWebhook(
    org: string,
    accessToken: string,
    webhookConfig: WebhookConfig
  ): Promise<number> {
    const response = await fetch(
      `${this.githubBaseUrl}/orgs/${org}/hooks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            url: webhookConfig.url,
            content_type: webhookConfig.content_type || 'json',
            secret: webhookConfig.secret,
            insecure_ssl: webhookConfig.insecure_ssl || '0',
          },
          events: webhookConfig.events || ['pull_request'],
          active: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create organization webhook: ${response.status} - ${error}`);
    }

    const webhook = await response.json();
    return webhook.id;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(
    owner: string,
    repo: string,
    webhookId: number,
    accessToken: string,
    isOrg = false
  ): Promise<void> {
    const endpoint = isOrg 
      ? `${this.githubBaseUrl}/orgs/${owner}/hooks/${webhookId}`
      : `${this.githubBaseUrl}/repos/${owner}/${repo}/hooks/${webhookId}`;

    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete webhook: ${response.status}`);
    }
  }

  /**
   * Get webhook URL for this app
   */
  getWebhookUrl(): string {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5052';
    return `${baseUrl}/github/webhook`;
  }

  /**
   * Generate webhook secret token
   */
  generateWebhookSecret(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
