import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { SecGenerarReporte } from './sec-generar-reporte';

describe('SecGenerarReporte', () => {
  let component: SecGenerarReporte;
  let fixture: ComponentFixture<SecGenerarReporte>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecGenerarReporte, HttpClientTestingModule],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecGenerarReporte);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
