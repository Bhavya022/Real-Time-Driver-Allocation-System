import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as swaggerUi from 'swagger-ui-express';
import { AppModule } from './app.module';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Vybe Real-Time Driver Allocation API',
    version: '1.0.0',
    description: 'Real-time driver allocation and ride assignment API',
  },
  paths: {
    '/drivers': {
      post: {
        summary: 'Register or update driver location',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  lon: { type: 'number', minimum: -180, maximum: 180 },
                  lat: { type: 'number', minimum: -90, maximum: 90 },
                },
                required: ['id', 'lon', 'lat'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Driver created or updated' },
        },
      },
    },
    '/drivers/{id}/available': {
      post: {
        summary: 'Set driver availability',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { available: { type: 'boolean' } },
                required: ['available'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Availability updated' },
        },
      },
    },
    '/rides': {
      post: {
        summary: 'Request a new ride',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  lon: { type: 'number', minimum: -180, maximum: 180 },
                  lat: { type: 'number', minimum: -90, maximum: 90 },
                },
                required: ['lon', 'lat'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Ride request created' },
        },
      },
    },
    '/rides/{id}/accept': {
      post: {
        summary: 'Accept a ride',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { driverId: { type: 'string' } },
                required: ['driverId'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Ride accepted by a driver' },
        },
      },
    },
    '/rides/{id}': {
      get: {
        summary: 'Fetch ride status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Ride status returned' },
        },
      },
    },
  },
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  const port = process.env.PORT || 3000;
  app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  await app.listen(port);
  console.log(`Server running on ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
