import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerarReporte } from './generar-reporte';

describe('GenerarReporte', () => {
  let component: GenerarReporte;
  let fixture: ComponentFixture<GenerarReporte>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerarReporte]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerarReporte);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
