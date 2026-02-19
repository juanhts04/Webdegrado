import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisarAsistencia } from './supervisar-asistencia';

describe('SupervisarAsistencia', () => {
  let component: SupervisarAsistencia;
  let fixture: ComponentFixture<SupervisarAsistencia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisarAsistencia]
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
