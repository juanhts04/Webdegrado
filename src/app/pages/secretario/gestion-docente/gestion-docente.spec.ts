import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { GestionDocente } from './gestion-docente';

describe('GestionDocente', () => {
  let component: GestionDocente;
  let fixture: ComponentFixture<GestionDocente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionDocente, HttpClientTestingModule],
			providers: [
				{ provide: PLATFORM_ID, useValue: 'server' },
				provideRouter([]),
			],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionDocente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
