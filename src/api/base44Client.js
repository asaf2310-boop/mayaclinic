import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createSupabaseDataClient, useSupabaseBackend } from './dataClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const collectionMethods = new Set(['list', 'filter']);

const normalizeCollection = (result) => {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== 'object') return [];

  const collection =
    result.items ??
    result.data ??
    result.records ??
    result.results ??
    result.rows;

  if (Array.isArray(collection)) return collection;

  console.warn('Expected Base44 collection response, received:', result);
  return [];
};

const createCollectionSafeClient = (client) => {
  const entityProxyCache = new Map();

  const entities = new Proxy(client.entities, {
    get(target, entityName) {
      const entity = target[entityName];
      if (!entity || typeof entity !== 'object') return entity;

      if (!entityProxyCache.has(entityName)) {
        entityProxyCache.set(entityName, new Proxy(entity, {
          get(entityTarget, methodName) {
            const method = entityTarget[methodName];
            if (typeof method !== 'function' || !collectionMethods.has(methodName)) {
              return method;
            }

            return async (...args) => normalizeCollection(await method.apply(entityTarget, args));
          }
        }));
      }

      return entityProxyCache.get(entityName);
    }
  });

  return new Proxy(client, {
    get(target, propertyName) {
      if (propertyName === 'entities') return entities;
      return target[propertyName];
    }
  });
};

const rawBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

export const base44 = useSupabaseBackend()
  ? createSupabaseDataClient()
  : createCollectionSafeClient(rawBase44);

export const backendMode = useSupabaseBackend() ? 'supabase' : 'base44';
