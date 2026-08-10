import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

const id = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const spec = {
  openapi: '3.1.0',
  info: { title: 'Berth API', version: '0.11.1', description: 'Manage services, deployments, variables, jobs, backups, and infrastructure. Authenticate with a berth_* personal API token.' },
  servers: [{ url: '/api' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
  security: [{ bearerAuth: [] }],
  paths: {
    '/services': { get: { summary: 'List services', responses: { '200': { description: 'Services' } } }, post: { summary: 'Create a service', responses: { '201': { description: 'Created' } } } },
    '/services/{id}': { get: { summary: 'Get a service', parameters: [id], responses: { '200': { description: 'Service' } } } },
    '/services/{id}/redeploy': { post: { summary: 'Redeploy a service', parameters: [id], responses: { '201': { description: 'Requested' } } } },
    '/services/{id}/logs': { get: { summary: 'Get buffered logs', parameters: [id], responses: { '200': { description: 'Log lines' } } } },
    '/services/{id}/env': { get: { summary: 'Get variables', parameters: [id], responses: { '200': { description: 'Variables' } } }, put: { summary: 'Replace variables', parameters: [id], responses: { '200': { description: 'Variables' } } } },
    '/services/{id}/jobs': { get: { summary: 'List schedules and runs', parameters: [id], responses: { '200': { description: 'Jobs' } } }, post: { summary: 'Create a cron schedule', parameters: [id], responses: { '201': { description: 'Created' } } } },
    '/compose/import': { post: { summary: 'Import Docker Compose services', responses: { '201': { description: 'Imported services' } } } },
    '/notification-channels': { post: { summary: 'Create an outbound webhook', description: 'Generic webhooks receive deployment.succeeded, deployment.failed, and service.crashed events. HMAC signatures use X-Berth-Signature.', responses: { '201': { description: 'Created' } } } },
  },
};

@Public()
@Controller()
export class OpenApiController {
  @Get('openapi.json') openapi() { return spec; }
  @Get('docs') @Header('Content-Type', 'text/html; charset=utf-8') docs() {
    return '<!doctype html><title>Berth API</title><meta name="viewport" content="width=device-width"><script id="api-reference" data-url="/api/openapi.json"></script><script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>';
  }
}
