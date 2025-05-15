import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OuncePriceBannerComponent } from './ounce-price-banner.component';

describe('OuncePriceBannerComponent', () => {
  let component: OuncePriceBannerComponent;
  let fixture: ComponentFixture<OuncePriceBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OuncePriceBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OuncePriceBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
