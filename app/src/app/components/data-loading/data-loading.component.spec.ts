import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataLoadingComponent } from './data-loading.component';

describe('DataLoadingComponent', () => {
  let component: DataLoadingComponent;
  let fixture: ComponentFixture<DataLoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataLoadingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataLoadingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
