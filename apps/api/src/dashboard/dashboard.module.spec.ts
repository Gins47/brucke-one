import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { DashboardController } from './dashboard.controller';
import { DashboardModule } from './dashboard.module';
import { DashboardService } from './dashboard.service';

describe('DashboardModule', () => {
  /** Compiles the dashboard boundary independently of future projections. */
  it('creates the dashboard module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DashboardModule],
    }).compile();

    expect(module.get(DashboardController)).toBeInstanceOf(DashboardController);
    expect(module.get(DashboardService)).toBeInstanceOf(DashboardService);

    await module.close();
  });

  /** Ensures application module assembly includes the dashboard boundary. */
  it('compiles the application module with the dashboard registered', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(DashboardController)).toBeInstanceOf(DashboardController);
    expect(module.get(DashboardService)).toBeInstanceOf(DashboardService);

    await module.close();
  });
});
