import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarEstudianteCurso } from './registrar-estudiante-curso';

describe('RegistrarEstudianteCurso', () => {
  let component: RegistrarEstudianteCurso;
  let fixture: ComponentFixture<RegistrarEstudianteCurso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarEstudianteCurso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarEstudianteCurso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
