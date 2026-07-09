import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { HttpErrorFilter } from './common/httpErrorFilter';
import cookieParser from 'cookie-parser';
import { FabIntegrationModule } from './fab-integration/fab-integration.module';

async function bootstrap() {
  // Temporary config service to get env variables before app creation
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.use(
    express.json({
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());

  // Reuse configService after app creation
  const config = new DocumentBuilder()
    .setTitle('Infinia API')
    .setDescription('API documentation for Infinia Service')
    .setVersion('1.0')
    .addTag('List')
    .addTag('Donation Opportunities')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'access-token', // name of security
    )
    .build();
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads'))); // Serve images
  app.setGlobalPrefix('api');

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const fabDoc = SwaggerModule.createDocument(app, config, {
    include: [FabIntegrationModule],
  });

  SwaggerModule.setup('fab', app, fabDoc);
  app.getHttpAdapter().get('/fab-json', (req, res) => {
    res.json(fabDoc);
  });
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = configService.get<number>('app.port', { infer: true });

  console.log(`🚀 Server is listening on port ${port} (${'HTTP'})`);

  await app.listen(port);
}
bootstrap();
