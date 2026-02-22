import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

import { SupervisarAsistencia } from './supervisar-asistencia';

describe('SupervisarAsistencia', () => {
  let component: SupervisarAsistencia;
  let fixture: ComponentFixture<SupervisarAsistencia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisarAsistencia],
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupervisarAsistencia);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
