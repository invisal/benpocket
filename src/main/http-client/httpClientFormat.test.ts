import { describe, expect, it } from 'vitest';
import type { CollectionFolder, SavedRequest } from '../../preload/http-client/types';
import {
  importOpenApiFile,
  isOpenApiFile,
  isSwaggerV2File,
  type OpenApiFile
} from './httpClientFormat';

/** Collects every request in a collection/folder tree, regardless of which nested folder it landed in. */
function flattenRequests(container: {
  requests: SavedRequest[];
  folders: CollectionFolder[];
}): SavedRequest[] {
  return [...container.requests, ...container.folders.flatMap(flattenRequests)];
}

describe('isOpenApiFile', () => {
  it('accepts a 3.x document with a paths object', () => {
    expect(isOpenApiFile({ openapi: '3.0.3', paths: {} })).toBe(true);
    expect(isOpenApiFile({ openapi: '3.1.0', paths: {} })).toBe(true);
  });

  it('rejects non-3.x or malformed documents', () => {
    expect(isOpenApiFile({ openapi: '2.0', paths: {} })).toBe(false);
    expect(isOpenApiFile({ openapi: '3.0.3' })).toBe(false);
    expect(isOpenApiFile({ paths: {} })).toBe(false);
    expect(isOpenApiFile(null)).toBe(false);
    expect(isOpenApiFile('not an object')).toBe(false);
  });
});

describe('isSwaggerV2File', () => {
  it('detects the swagger 2.0 shape', () => {
    expect(isSwaggerV2File({ swagger: '2.0', paths: {} })).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isSwaggerV2File({ openapi: '3.0.3', paths: {} })).toBe(false);
    expect(isSwaggerV2File(null)).toBe(false);
  });
});

describe('importOpenApiFile', () => {
  it('converts a path template and query/header parameters into a request URL and headers', () => {
    const file: OpenApiFile = {
      openapi: '3.0.3',
      info: { title: 'Pet Store' },
      servers: [{ url: 'https://api.example.com/v1' }],
      paths: {
        '/pets/{petId}': {
          get: {
            summary: 'Get a pet',
            parameters: [
              { name: 'petId', in: 'path', required: true },
              { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
              { name: 'X-Trace-Id', in: 'header' }
            ]
          }
        }
      }
    };

    const { collection, openApiVersion, variables } = importOpenApiFile(file, 'workspace-1');

    expect(openApiVersion).toBe('3.0.3');
    expect(collection.name).toBe('Pet Store');
    expect(collection.workspaceId).toBe('workspace-1');
    expect(variables).toEqual([]);
    expect(collection.requests).toEqual([]);

    // Each URL path segment nests into its own folder, mirroring Postman's importer.
    expect(collection.folders).toHaveLength(1);
    expect(collection.folders[0].name).toBe('pets');
    expect(collection.folders[0].requests).toEqual([]);
    expect(collection.folders[0].folders).toHaveLength(1);
    expect(collection.folders[0].folders[0].name).toBe('{petId}');
    expect(collection.folders[0].folders[0].requests).toHaveLength(1);

    const request = collection.folders[0].folders[0].requests[0];
    expect(request.name).toBe('Get a pet');
    expect(request.method).toBe('GET');
    expect(request.url).toBe('https://api.example.com/v1/pets/{{petId}}?limit=10');
    expect(request.headers).toEqual([
      expect.objectContaining({ key: 'X-Trace-Id', value: '{{X-Trace-Id}}', enabled: true })
    ]);
  });

  it('nests requests into folders by URL path segment, sharing folders across paths with a common prefix', () => {
    const file: OpenApiFile = {
      openapi: '3.1.0',
      paths: {
        '/pets': {
          get: { operationId: 'listPets' },
          post: { operationId: 'createPet' }
        },
        '/pets/{petId}': {
          get: { operationId: 'getPet' }
        },
        '/health': {
          get: { operationId: 'health' }
        }
      }
    };

    const { collection } = importOpenApiFile(file, 'workspace-1');

    expect(collection.requests).toEqual([]);
    expect(collection.folders.map((f) => f.name)).toEqual(['pets', 'health']);

    const pets = collection.folders[0];
    expect(pets.requests.map((r) => r.name)).toEqual(['listPets', 'createPet']);
    expect(pets.folders).toHaveLength(1);
    expect(pets.folders[0].name).toBe('{petId}');
    expect(pets.folders[0].requests.map((r) => r.name)).toEqual(['getPet']);

    const health = collection.folders[1];
    expect(health.requests.map((r) => r.name)).toEqual(['health']);
  });

  it('builds a JSON body from an inline example, falling back to a schema-derived stub', () => {
    const file: OpenApiFile = {
      openapi: '3.0.3',
      paths: {
        '/pets': {
          post: {
            operationId: 'createPet',
            requestBody: {
              content: {
                'application/json': {
                  example: { name: 'Rex' }
                }
              }
            }
          }
        },
        '/owners': {
          post: {
            operationId: 'createOwner',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' }, age: { type: 'integer' } }
                  }
                }
              }
            }
          }
        }
      }
    };

    const { collection } = importOpenApiFile(file, 'workspace-1');
    const requests = flattenRequests(collection);
    const withExample = requests.find((r) => r.name === 'createPet')!;
    const fromSchema = requests.find((r) => r.name === 'createOwner')!;

    expect(withExample.bodyType).toBe('json');
    expect(JSON.parse(withExample.body)).toEqual({ name: 'Rex' });

    expect(fromSchema.bodyType).toBe('json');
    expect(JSON.parse(fromSchema.body)).toEqual({ name: 'string', age: 0 });
  });

  it('resolves a $ref schema when generating a body stub', () => {
    const file: OpenApiFile = {
      openapi: '3.0.3',
      paths: {
        '/pets': {
          post: {
            operationId: 'createPet',
            requestBody: {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Pet' } }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          Pet: { type: 'object', properties: { name: { type: 'string' } } }
        }
      }
    };

    const { collection } = importOpenApiFile(file, 'workspace-1');
    expect(JSON.parse(flattenRequests(collection)[0].body)).toEqual({ name: 'string' });
  });

  it('maps bearer and apiKey security schemes to structured auth with variable-token placeholders', () => {
    const file: OpenApiFile = {
      openapi: '3.0.3',
      paths: {
        '/secure': {
          get: { operationId: 'secureBearer', security: [{ bearerAuth: [] }] }
        },
        '/keyed': {
          get: { operationId: 'secureKey', security: [{ apiKeyAuth: [] }] }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
          apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
        }
      }
    };

    const { collection } = importOpenApiFile(file, 'workspace-1');
    const requests = flattenRequests(collection);
    const bearerRequest = requests.find((r) => r.name === 'secureBearer')!;
    const apiKeyRequest = requests.find((r) => r.name === 'secureKey')!;

    expect(bearerRequest.auth).toEqual({ type: 'bearer', bearer: { token: '{{bearerAuth}}' } });
    expect(apiKeyRequest.auth).toEqual({
      type: 'apikey',
      apikey: { key: 'X-API-Key', value: '{{apiKeyAuth}}', in: 'header' }
    });
  });

  it('seeds an empty environment variable for a server variable without a default', () => {
    const file: OpenApiFile = {
      openapi: '3.0.3',
      servers: [
        {
          url: 'https://{host}/v1',
          variables: { host: {} }
        }
      ],
      paths: { '/ping': { get: { operationId: 'ping' } } }
    };

    const { collection, variables } = importOpenApiFile(file, 'workspace-1');
    expect(flattenRequests(collection)[0].url).toBe('https://{{host}}/v1/ping');
    expect(variables).toEqual([expect.objectContaining({ key: 'host', value: '', enabled: true })]);
  });
});
