import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { GestionHorario } from './gestion-horario';

describe('GestionHorario', () => {
  let component: GestionHorario;
  let fixture: ComponentFixture<GestionHorario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
			imports: [GestionHorario, HttpClientTestingModule],
			providers: [
				{ provide: PLATFORM_ID, useValue: 'server' },
				provideRouter([]),
			],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionHorario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
