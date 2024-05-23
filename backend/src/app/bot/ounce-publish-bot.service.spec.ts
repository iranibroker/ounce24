import { Test, TestingModule } from '@nestjs/testing';
import { OuncePublishBotService } from './ounce-publish-bot.service';

describe('OuncePublishBotService', () => {
  let service: OuncePublishBotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OuncePublishBotService],
    }).compile();

    service = module.get<OuncePublishBotService>(OuncePublishBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
