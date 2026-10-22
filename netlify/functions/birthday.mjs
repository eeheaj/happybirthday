import { getStore } from '@netlify/blobs';
import { createAPI } from '../../server/api.mjs';

export default createAPI(() => ({
  notes: getStore({ name: 'birthday-notes', consistency: 'strong' }),
  images: getStore({ name: 'birthday-images', consistency: 'strong' })
}));

export const config = {
  path: '/api/*',
  rateLimit: { windowLimit: 240, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rate_limit' }
};
