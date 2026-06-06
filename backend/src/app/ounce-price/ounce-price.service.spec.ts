import { Test, TestingModule } from '@nestjs/testing';
import { OuncePriceService } from './ounce-price.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuoteService } from './quote.service';
import { OuncePriceHistoryService } from './ounce-price-history.service';
import { of } from 'rxjs';

describe('OuncePriceService', () => {
  let service: OuncePriceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OuncePriceService,
        {
          provide: QuoteService,
          useValue: {
            data: of(2300),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: OuncePriceHistoryService,
          useValue: {
            getLatestPrice: jest.fn().mockResolvedValue(2345.67),
          },
        },
      ],
    }).compile();

    service = module.get<OuncePriceService>(OuncePriceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
