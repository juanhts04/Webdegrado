import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

import { MisCursos } from './mis-cursos';

describe('MisCursos', () => {
  let component: MisCursos;
  let fixture: ComponentFixture<MisCursos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisCursos],
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MisCursos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
