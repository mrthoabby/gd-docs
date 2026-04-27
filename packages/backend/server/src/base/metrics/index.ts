import './config';

import { Global, Module } from '@nestjs/common';

@Global()
@Module({})
export class MetricsModule {}

export * from './metrics';
export * from './utils';
