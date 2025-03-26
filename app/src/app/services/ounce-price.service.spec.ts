import { TestBed } from '@angular/core/testing';

import { OuncePriceService } from './ounce-price.service';

describe('OuncePriceService', () => {
  let service: OuncePriceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OuncePriceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
