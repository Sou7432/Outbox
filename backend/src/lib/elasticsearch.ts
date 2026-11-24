import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';

export const esClient = new Client({
  node: config.elasticsearchUrl,
  requestTimeout: 3000,
  maxRetries: 2,
});

export const EMAILS_INDEX = 'emails_index';

let isElasticAvailable = false;

export async function checkElasticConnection(): Promise<boolean> {
  try {
    const health = await esClient.ping();
    isElasticAvailable = health;
    if (health) {
      console.log('✅ Connected to Elasticsearch at', config.elasticsearchUrl);
      await initEmailsIndex();
    }
    return health;
  } catch (error: any) {
    isElasticAvailable = false;
    console.warn(`⚠️ Elasticsearch is not reachable at ${config.elasticsearchUrl} (${error.message}). Elastic indexing will fallback gracefully.`);
    return false;
  }
}

export function isElasticsearchConnected(): boolean {
  return isElasticAvailable;
}

export async function initEmailsIndex() {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              senderEmail: { type: 'keyword' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              error: { type: 'text' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${EMAILS_INDEX}' created successfully`);
    }
  } catch (err: any) {
    console.error('Failed to init Elasticsearch index:', err.message);
  }
}

export async function indexEmailInElastic(email: {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  error?: string | null;
  createdAt: Date;
}) {
  if (!isElasticAvailable) return;
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      body: {
        id: email.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        senderEmail: email.senderEmail,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        error: email.error || null,
        createdAt: email.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.warn(`⚠️ Failed to index email ${email.id} to Elasticsearch:`, err.message);
  }
}

export async function searchEmailsInElastic(query: string, status?: string): Promise<string[] | null> {
  if (!isElasticAvailable) return null;
  try {
    const mustQueries: any[] = [];
    
    if (query && query.trim().length > 0) {
      mustQueries.push({
        multi_match: {
          query: query.trim(),
          fields: ['recipient^3', 'subject^2', 'body', 'senderEmail'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (status) {
      mustQueries.push({
        term: { status: status.toUpperCase() },
      });
    }

    const response = await esClient.search({
      index: EMAILS_INDEX,
      body: {
        query: mustQueries.length > 0 ? { bool: { must: mustQueries } } : { match_all: {} },
        sort: [{ scheduledAt: { order: 'desc' } }],
        size: 100,
      },
    });

    const hits = response.hits.hits;
    return hits.map((hit: any) => hit._id);
  } catch (err: any) {
    console.warn('⚠️ Elasticsearch search error:', err.message);
    return null;
  }
}
