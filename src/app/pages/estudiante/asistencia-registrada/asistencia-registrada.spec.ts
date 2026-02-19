import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsistenciaRegistrada } from './asistencia-registrada';

describe('AsistenciaRegistrada', () => {
  let component: AsistenciaRegistrada;
  let fixture: ComponentFixture<AsistenciaRegistrada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsistenciaRegistrada]
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
