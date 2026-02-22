import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { GestionSalon } from './gestion-salon';

describe('GestionSalon', () => {
  let component: GestionSalon;
  let fixture: ComponentFixture<GestionSalon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionSalon, HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        provideRouter([]),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionSalon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
