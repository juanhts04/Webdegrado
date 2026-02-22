import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

import { AsistenciaRegistrada } from './asistencia-registrada';

describe('AsistenciaRegistrada', () => {
  let component: AsistenciaRegistrada;
  let fixture: ComponentFixture<AsistenciaRegistrada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsistenciaRegistrada],
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsistenciaRegistrada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
