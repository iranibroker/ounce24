import { Test, TestingModule } from '@nestjs/testing';
import { GuardrailsService, GuardrailInput } from './guardrails.service';
import { SignalType, TradingStyle, RiskTolerance } from '@ounce24/types';

describe('GuardrailsService', () => {
  let service: GuardrailsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GuardrailsService],
    }).compile();

    service = module.get<GuardrailsService>(GuardrailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateSignal', () => {
    const baseInput: GuardrailInput = {
      type: SignalType.Buy,
      entryPrice: 2300,
      takeProfit: 2315,
      stopLoss: 2290,
      instantEntry: true,
      isVolatile: false,
      atr5m: 1.0,
      atr1h: 4.0,
      currentPrice: 2300,
      tradingStyle: TradingStyle.Day,
      riskTolerance: RiskTolerance.Moderate,
      successProbability: 75,
    };

    it('should validate successfully for standard signals passing all guidelines', () => {
      const result = service.validateSignal(baseInput);
      expect(result.isValid).toBe(true);
    });

    it('should reject signals with non-positive prices (catastrophic)', () => {
      const result = service.validateSignal({
        ...baseInput,
        entryPrice: -2300,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Prices must be greater than zero.');
    });

    it('should reject BUY signal if TP is below entry (catastrophic)', () => {
      const result = service.validateSignal({
        ...baseInput,
        takeProfit: 2290,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Take Profit ($2290) must be strictly greater than Entry Price ($2300)');
    });

    it('should reject BUY signal if SL is above entry (catastrophic)', () => {
      const result = service.validateSignal({
        ...baseInput,
        stopLoss: 2310,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Stop Loss ($2310) must be strictly less than Entry Price ($2300)');
    });

    it('should reject signals with R:R < 1.0 (catastrophic check, reward < risk)', () => {
      const result = service.validateSignal({
        ...baseInput,
        takeProfit: 2305, // TP dist = 5
        stopLoss: 2290,   // SL dist = 10
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Risk-to-Reward ratio (0.50) is invalid. R:R must be greater than or equal to 1.0.');
    });
  });
});
