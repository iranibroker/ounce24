import { Test, TestingModule } from '@nestjs/testing';
import { SignalsService } from './signals.service';
import { getModelToken } from '@nestjs/mongoose';
import { Signal, User, GemLog, SignalSubscription, SignalAnalyze, OuncePriceCandle } from '@ounce24/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AiChatService } from '../ai-chat/ai-chat.service';

describe('SignalsService', () => {
  let service: SignalsService;

  const mockModel = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalsService,
        {
          provide: getModelToken(Signal.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(GemLog.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(SignalSubscription.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(SignalAnalyze.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(OuncePriceCandle.name),
          useValue: mockModel,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: OuncePriceService,
          useValue: {
            current: 2300,
          },
        },
        {
          provide: AiChatService,
          useValue: {
            createResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SignalsService>(SignalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
