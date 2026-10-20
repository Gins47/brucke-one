import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { enableDevelopmentCors } from './cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  enableDevelopmentCors(app, process.env);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
