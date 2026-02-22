import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

import { Asistencia } from './asistencia';

describe('Asistencia', () => {
  let component: Asistencia;
  let fixture: ComponentFixture<Asistencia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Asistencia],
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Asistencia);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
