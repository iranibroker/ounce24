import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignalTypeChipComponent } from './signal-type-chip.component';

describe('SignalTypeChipComponent', () => {
  let component: SignalTypeChipComponent;
  let fixture: ComponentFixture<SignalTypeChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalTypeChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SignalTypeChipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
