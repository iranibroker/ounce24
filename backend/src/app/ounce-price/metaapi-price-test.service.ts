import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MetaApi, { SynchronizationListener } from 'metaapi.cloud-sdk';

class TestSynchronizationListener extends SynchronizationListener {
  private readonly logger = new Logger('MetaapiPriceTestService:Listener');

  constructor(private readonly symbol: string) {
    super();
  }

  override async onSymbolPriceUpdated(instanceIndex: string, price: any): Promise<any> {
    try {
      if (price && price.symbol === this.symbol) {
        const bid = price.bid;
        const ask = price.ask;
        const mid = (bid && ask) ? (bid + ask) / 2 : (bid || ask || 0);
        this.logger.log(
          `[TEST FEED] ${this.symbol} Tick Update - Bid: ${bid}, Ask: ${ask}, Mid: ${mid.toFixed(2)}, Time: ${price.time || 'N/A'}`
        );
      }
    } catch (error) {
      this.logger.error('Error processing price update in listener:', error);
    }
  }

  override async onSynchronizationStarted(
    instanceIndex: string,
    specificationsHash: string,
    positionsHash: string,
    ordersHash: string,
    synchronizationId: string
  ): Promise<any> {
    this.logger.log(`Synchronization started for instance: ${instanceIndex}`);
  }
}

@Injectable()
export class MetaapiPriceTestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MetaapiPriceTestService');
  private metaApi: MetaApi | null = null;
  private connection: any = null;
  private listener: TestSynchronizationListener | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const token = this.configService.get<string>('METAAPI_TOKEN');
    const accountId = this.configService.get<string>('METAAPI_ACCOUNT_ID');
    const symbol = this.configService.get<string>('METAAPI_SYMBOL') || 'XAUUSD';

    if (!token || !accountId) {
      this.logger.warn(
        'MetaAPI credentials are not configured (METAAPI_TOKEN and/or METAAPI_ACCOUNT_ID are missing in env). Standalone price stream test is inactive.'
      );
      return;
    }

    this.logger.log(`Initializing MetaAPI price stream test for account ${accountId} (Symbol: ${symbol})...`);
    this.initializeAndConnect(token, accountId, symbol);
  }

  private async initializeAndConnect(token: string, accountId: string, symbol: string) {
    try {
      this.metaApi = new MetaApi(token);
      const account = await this.metaApi.metatraderAccountApi.getAccount(accountId);
      
      this.connection = account.getStreamingConnection();
      this.listener = new TestSynchronizationListener(symbol);
      this.connection.addSynchronizationListener(this.listener);

      this.logger.log('Connecting to MetaAPI streaming WebSocket...');
      await this.connection.connect();

      this.logger.log('Waiting for terminal state synchronization...');
      await this.connection.waitSynchronized();

      this.logger.log(`Subscribing to market data for symbol ${symbol}...`);
      await this.connection.subscribeToMarketData(symbol);
      this.logger.log(`Successfully subscribed to ${symbol} real-time updates! Check logs below.`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize or connect MetaAPI: ${error.message || error}`);
      this.logger.log('Retrying MetaAPI connection in 10 seconds...');
      this.retryTimeout = setTimeout(() => {
        this.initializeAndConnect(token, accountId, symbol);
      }, 10000);
    }
  }

  async onModuleDestroy() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.connection) {
      this.logger.log('Closing MetaAPI streaming connection...');
      try {
        await this.connection.close();
      } catch (error: any) {
        this.logger.error(`Error closing MetaAPI connection: ${error.message || error}`);
      }
      this.connection = null;
    }

    if (this.metaApi) {
      this.metaApi = null;
    }
  }
}
