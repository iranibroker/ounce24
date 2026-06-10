import { Test, TestingModule } from '@nestjs/testing';
import { SignalsController } from './signals.controller';
import { getModelToken } from '@nestjs/mongoose';
import { Signal, User, Follow, SignalSubscription } from '@ounce24/types';
import { SignalsService } from './signals.service';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AuthService } from '../auth/auth.service';

describe('SignalsController', () => {
  let controller: SignalsController;

  const mockModel = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SignalsController],
      providers: [
        {
          provide: getModelToken(Signal.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Follow.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(SignalSubscription.name),
          useValue: mockModel,
        },
        {
          provide: SignalsService,
          useValue: {
            getMarketState: jest.fn(),
            addSignal: jest.fn(),
            analyzeSignal: jest.fn(),
            generateSignal: jest.fn(),
            cancelSignal: jest.fn(),
            manualCloseSignal: jest.fn(),
            makeSignalRiskFree: jest.fn(),
            getSubscription: jest.fn(),
            updateSubscription: jest.fn(),
          },
        },
        {
          provide: OuncePriceService,
          useValue: {
            current: 2300,
          },
        },
        {
          provide: AuthService,
          useValue: {
            getUserIdFromRequest: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SignalsController>(SignalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
