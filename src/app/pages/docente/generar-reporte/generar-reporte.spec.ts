import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

import { GenerarReporte } from './generar-reporte';

describe('GenerarReporte', () => {
  let component: GenerarReporte;
  let fixture: ComponentFixture<GenerarReporte>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerarReporte],
      providers: [provideHttpClientTesting(), provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
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
