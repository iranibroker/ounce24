import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignalAnalyzeBottomSheetComponent } from './signal-analyze-bottom-sheet.component';

describe('SignalAnalyzeBottomSheetComponent', () => {
  let component: SignalAnalyzeBottomSheetComponent;
  let fixture: ComponentFixture<SignalAnalyzeBottomSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalAnalyzeBottomSheetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SignalAnalyzeBottomSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
}); 