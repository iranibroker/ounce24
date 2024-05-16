import { Test, TestingModule } from '@nestjs/testing';
import { OuncePriceService } from './ounce-price.service';

describe('OuncePriceService', () => {
  let service: OuncePriceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OuncePriceService],
    }).compile();

    service = module.get<OuncePriceService>(OuncePriceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
