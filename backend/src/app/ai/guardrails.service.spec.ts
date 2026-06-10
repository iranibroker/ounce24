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

    it('should reject signals with R:R <= 1.0 (catastrophic check, reward <= risk)', () => {
      const result = service.validateSignal({
        ...baseInput,
        takeProfit: 2305, // TP dist = 5
        stopLoss: 2290,   // SL dist = 10
        successProbability: 95, // Even with 95% AI confidence, catastrophic check fails
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Risk-to-Reward ratio (0.50) is catastrophic. R:R must be strictly greater than 1.0.');
    });

    it('should reject standard signals failing risk R:R minimum when successProbability is low (< 80)', () => {
      const result = service.validateSignal({
        ...baseInput,
        takeProfit: 2311, // TP dist = 11, SL dist = 10 -> R:R = 1.1 (Min R:R for Moderate is 1.2)
        stopLoss: 2290,
        successProbability: 70, // Below 80 override
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Risk-to-Reward ratio (1.10) is below the minimum requirement');
    });

    it('should bypass R:R standard check if successProbability is high (>= 80)', () => {
      const result = service.validateSignal({
        ...baseInput,
        takeProfit: 2311, // R:R = 1.1
        stopLoss: 2290,
        successProbability: 85, // Above 80 override
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject instant market entry during high volatility with successProbability < 80', () => {
      const result = service.validateSignal({
        ...baseInput,
        isVolatile: true,
        instantEntry: true,
        successProbability: 75,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Instant entries are prohibited during high volatility states.');
    });

    it('should bypass high volatility instant entry ban with successProbability >= 80', () => {
      const result = service.validateSignal({
        ...baseInput,
        isVolatile: true,
        instantEntry: true,
        successProbability: 80, // High confidence setup
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject limit entry that is too far when successProbability < 80', () => {
      const result = service.validateSignal({
        ...baseInput,
        entryPrice: 2280, // Distance to current = 20 (Max distance = 4 * 1h ATR of 4 = 16)
        stopLoss: 2270, // Below entry for BUY
        takeProfit: 2310, // Above entry for BUY
        instantEntry: false,
        successProbability: 75,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Limit Entry Price ($2280.00) is too far from current price');
    });

    it('should bypass limit entry distance check when successProbability >= 80', () => {
      const result = service.validateSignal({
        ...baseInput,
        entryPrice: 2280, // Distance to current = 20 (Max distance = 16)
        stopLoss: 2270, // Below entry for BUY
        takeProfit: 2310, // Above entry for BUY
        instantEntry: false,
        successProbability: 80, // High confidence setup
      });
      expect(result.isValid).toBe(true);
    });
  });
});
