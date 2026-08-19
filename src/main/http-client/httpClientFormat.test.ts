import { describe, expect, it } from 'vitest';
import type { CollectionFolder, SavedRequest } from '../../preload/http-client/types';
import {
  importInsomniaV4File,
  importInsomniaV5File,
  importOpenApiFile,
  isInsomniaV4File,
  isInsomniaV5File,
  isOpenApiFile,
  isSwaggerV2File,
  type InsomniaV4File,
  type InsomniaV5File,
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

describe('isInsomniaV4File', () => {
  it('accepts the v4 export shape', () => {
    expect(isInsomniaV4File({ __export_format: 4, resources: [] })).toBe(true);
  });

  it('rejects other export formats or malformed documents', () => {
    expect(isInsomniaV4File({ __export_format: 3, resources: [] })).toBe(false);
    expect(isInsomniaV4File({ __export_format: 4 })).toBe(false);
    expect(isInsomniaV4File(null)).toBe(false);
    expect(isInsomniaV4File('not an object')).toBe(false);
  });
});

describe('importInsomniaV4File', () => {
  it('rebuilds the folder tree from parentId links, ignoring resource array order, ordered by metaSortKey', () => {
    // Deliberately out of tree order, as a real Insomnia export's `resources` array is.
    const file: InsomniaV4File = {
      __export_format: 4,
      resources: [
        {
          _id: 'req_2',
          _type: 'request',
          parentId: 'fld_1',
          name: 'Get Pet',
          method: 'get',
          url: 'https://api.example.com/pets/:id',
          metaSortKey: 2
        },
        {
          _id: 'fld_1',
          _type: 'request_group',
          parentId: 'wrk_1',
          name: 'Pets',
          metaSortKey: 1
        },
        {
          _id: 'wrk_1',
          _type: 'workspace',
          parentId: null,
          name: 'My Workspace'
        },
        {
          _id: 'req_1',
          _type: 'request',
          parentId: 'wrk_1',
          name: 'Health Check',
          method: 'get',
          url: 'https://api.example.com/health',
          metaSortKey: 0
        }
      ]
    };

    const { collection } = importInsomniaV4File(file, 'workspace-1');

    expect(collection.name).toBe('My Workspace');
    expect(collection.workspaceId).toBe('workspace-1');
    expect(collection.requests.map((r) => r.name)).toEqual(['Health Check']);
    expect(collection.folders).toHaveLength(1);
    expect(collection.folders[0].name).toBe('Pets');
    expect(collection.folders[0].requests.map((r) => r.name)).toEqual(['Get Pet']);

    const getPet = collection.folders[0].requests[0];
    expect(getPet.method).toBe('GET');
    expect(getPet.url).toBe('https://api.example.com/pets/{{id}}');
  });

  it('appends enabled query parameters onto the url and drops disabled ones', () => {
    const file: InsomniaV4File = {
      __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', parentId: null, name: 'WS' },
        {
          _id: 'req_1',
          _type: 'request',
          parentId: 'wrk_1',
          name: 'Search',
          method: 'get',
          url: 'https://api.example.com/search',
          parameters: [
            { name: 'q', value: 'cats' },
            { name: 'page', value: '2', disabled: true }
          ]
        }
      ]
    };

    const { collection } = importInsomniaV4File(file, 'workspace-1');
    const request = collection.requests[0];
    expect(request.url).toBe('https://api.example.com/search?q=cats');
    expect(request.params).toEqual([
      expect.objectContaining({ key: 'q', value: 'cats', enabled: true })
    ]);
  });

  it('maps a JSON body and an urlencoded form body', () => {
    const file: InsomniaV4File = {
      __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', parentId: null, name: 'WS' },
        {
          _id: 'req_1',
          _type: 'request',
          parentId: 'wrk_1',
          name: 'Create Pet',
          method: 'post',
          url: 'https://api.example.com/pets',
          body: { mimeType: 'application/json', text: '{"name":"Rex"}' }
        },
        {
          _id: 'req_2',
          _type: 'request',
          parentId: 'wrk_1',
          name: 'Login',
          method: 'post',
          url: 'https://api.example.com/login',
          body: {
            mimeType: 'application/x-www-form-urlencoded',
            params: [{ name: 'user', value: 'rex' }]
          }
        }
      ]
    };

    const { collection } = importInsomniaV4File(file, 'workspace-1');
    const createPet = collection.requests.find((r) => r.name === 'Create Pet')!;
    const login = collection.requests.find((r) => r.name === 'Login')!;

    expect(createPet.bodyType).toBe('json');
    expect(createPet.body).toBe('{"name":"Rex"}');
    expect(login.bodyType).toBe('form');
    expect(login.body).toBe('user=rex');
  });

  it('maps bearer authentication to structured auth', () => {
    const file: InsomniaV4File = {
      __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', parentId: null, name: 'WS' },
        {
          _id: 'req_1',
          _type: 'request',
          parentId: 'wrk_1',
          name: 'Secure',
          method: 'get',
          url: 'https://api.example.com/secure',
          authentication: { type: 'bearer', token: 'abc123' }
        }
      ]
    };

    const { collection } = importInsomniaV4File(file, 'workspace-1');
    expect(collection.requests[0].auth).toEqual({ type: 'bearer', bearer: { token: 'abc123' } });
  });

  it("with a single sub-environment, merges the base environment's data underneath it and names the result after the sub-environment", () => {
    const file: InsomniaV4File = {
      __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', parentId: null, name: 'WS' },
        {
          _id: 'env_base',
          _type: 'environment',
          parentId: 'wrk_1',
          name: 'Base',
          data: { base_url: 'https://api.example.com', scheme: 'https' }
        },
        {
          _id: 'env_sub',
          _type: 'environment',
          parentId: 'env_base',
          name: 'Dev',
          data: { scheme: 'http' }
        }
      ]
    };

    const { environments } = importInsomniaV4File(file, 'workspace-1');
    expect(environments).toHaveLength(1);
    expect(environments[0].name).toBe('Dev');
    expect(environments[0].variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'base_url', value: 'https://api.example.com' }),
        expect.objectContaining({ key: 'scheme', value: 'http' })
      ])
    );
  });

  it('with multiple sub-environments (switchable profiles), produces one environment per sub-environment rather than merging them together', () => {
    const file: InsomniaV4File = {
      __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', parentId: null, name: 'WS' },
        {
          _id: 'env_base',
          _type: 'environment',
          parentId: 'wrk_1',
          name: 'Base',
          data: { scheme: 'https' }
        },
        {
          _id: 'env_cloud',
          _type: 'environment',
          parentId: 'env_base',
          name: 'Cloud',
          data: { host: 'api.example.com' }
        },
        {
          _id: 'env_local',
          _type: 'environment',
          parentId: 'env_base',
          name: 'Local',
          data: { scheme: 'http', host: 'localhost:4567' }
        }
      ]
    };

    const { environments } = importInsomniaV4File(file, 'workspace-1');
    expect(environments.map((e) => e.name)).toEqual(['Cloud', 'Local']);

    const cloud = environments.find((e) => e.name === 'Cloud')!;
    expect(cloud.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'scheme', value: 'https' }),
        expect.objectContaining({ key: 'host', value: 'api.example.com' })
      ])
    );

    const local = environments.find((e) => e.name === 'Local')!;
    expect(local.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'scheme', value: 'http' }),
        expect.objectContaining({ key: 'host', value: 'localhost:4567' })
      ])
    );
  });
});

describe('isInsomniaV5File', () => {
  it('accepts collection and design-document v5 exports', () => {
    expect(isInsomniaV5File({ type: 'collection.insomnia.rest/5.0' })).toBe(true);
    expect(isInsomniaV5File({ type: 'spec.insomnia.rest/5.0' })).toBe(true);
  });

  it('rejects other types or malformed documents', () => {
    expect(isInsomniaV5File({ type: 'mock.insomnia.rest/5.0' })).toBe(false);
    expect(isInsomniaV5File({ __export_format: 4 })).toBe(false);
    expect(isInsomniaV5File(null)).toBe(false);
  });
});

describe('importInsomniaV5File', () => {
  it('recursively walks nested folders via `children`, skips non-HTTP request nodes, and builds folder auth', () => {
    const file: InsomniaV5File = {
      type: 'collection.insomnia.rest/5.0',
      name: 'My Workspace',
      collection: [
        {
          name: 'Pets',
          authentication: { type: 'bearer', token: 'folder-token' },
          children: [
            { name: 'List Pets', method: 'GET', url: 'https://api.example.com/pets' },
            { name: 'A gRPC call', children: undefined } // no `method` and no `children` -> unsupported, skipped
          ]
        },
        { name: 'Health', method: 'GET', url: 'https://api.example.com/health' }
      ]
    };

    const { collection } = importInsomniaV5File(file, 'workspace-1');

    expect(collection.name).toBe('My Workspace');
    expect(collection.requests.map((r) => r.name)).toEqual(['Health']);
    expect(collection.folders).toHaveLength(1);
    expect(collection.folders[0].name).toBe('Pets');
    expect(collection.folders[0].auth).toEqual({
      type: 'bearer',
      bearer: { token: 'folder-token' }
    });
    expect(collection.folders[0].requests.map((r) => r.name)).toEqual(['List Pets']);
  });

  it('converts `:param` path segments the same way v4 does', () => {
    const file: InsomniaV5File = {
      type: 'collection.insomnia.rest/5.0',
      collection: [{ name: 'Get Pet', method: 'GET', url: 'https://api.example.com/pets/:id' }]
    };

    const { collection } = importInsomniaV5File(file, 'workspace-1');
    expect(collection.requests[0].url).toBe('https://api.example.com/pets/{{id}}');
  });

  it('strips the `_.` environment-lookup prefix newer Insomnia exports use in `{{ _.name }}` tokens, in the url, headers, and body', () => {
    const file: InsomniaV5File = {
      type: 'collection.insomnia.rest/5.0',
      collection: [
        {
          name: 'Create Pet',
          method: 'POST',
          url: '{{ _.base_url }}/pets',
          headers: [{ name: 'X-Api-Key', value: '{{ _.apiKey }}' }],
          body: { mimeType: 'application/json', text: '{"owner":"{{ _.username }}"}' }
        }
      ]
    };

    const { collection } = importInsomniaV5File(file, 'workspace-1');
    const request = collection.requests[0];
    expect(request.url).toBe('{{base_url}}/pets');
    expect(request.headers[0].value).toBe('{{apiKey}}');
    expect(request.body).toBe('{"owner":"{{username}}"}');
  });

  it('produces one environment per sub-environment, matching the real switchable-profile shape Insomnia exports', () => {
    const file: InsomniaV5File = {
      type: 'collection.insomnia.rest/5.0',
      name: 'WS',
      environments: {
        name: 'Base environment',
        data: { scheme: 'https' },
        subEnvironments: [
          { name: 'apichallenges.com', data: { host: 'apichallenges.com' } },
          { name: 'localhost:4567', data: { scheme: 'http', host: 'localhost:4567' } }
        ]
      }
    };

    const { environments } = importInsomniaV5File(file, 'workspace-1');
    expect(environments.map((e) => e.name)).toEqual(['apichallenges.com', 'localhost:4567']);
    expect(environments[0].variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'scheme', value: 'https' }),
        expect.objectContaining({ key: 'host', value: 'apichallenges.com' })
      ])
    );
  });

  it('fully resolves a variable composed from its sibling variables (Insomnia\'s `base_url: "{{ _.scheme }}://{{ _.host }}{{ _.base_path }}"` convention) into a plain literal, since this app\'s own resolver only expands `{{ }}` tokens one level deep', () => {
    const file: InsomniaV5File = {
      type: 'collection.insomnia.rest/5.0',
      name: 'WS',
      environments: {
        name: 'Base environment',
        data: { base_url: '{{ _.scheme }}://{{ _.host }}{{ _.base_path }}' },
        subEnvironments: [
          { name: 'Cloud', data: { scheme: 'https', host: 'apichallenges.com', base_path: '' } }
        ]
      }
    };

    const { environments } = importInsomniaV5File(file, 'workspace-1');
    const base_url = environments[0].variables.find((v) => v.key === 'base_url')!;
    expect(base_url.value).toBe('https://apichallenges.com');
  });
});
