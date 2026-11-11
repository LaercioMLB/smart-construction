import { DemoError } from '@/shared/contracts';
let latency = 0;
let failures = 0;
export const demoConfig = {
  configure(options: { latency?: number; failures?: number }) {
    latency = options.latency ?? 0;
    failures = options.failures ?? 0;
  },
  async beforeOperation() {
    if (latency > 0) await new Promise<void>((resolve) => setTimeout(resolve, latency));
    if (failures > 0) {
      failures--;
      throw new DemoError();
    }
  },
};
