import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionCurso } from './gestion-curso';

describe('GestionCurso', () => {
  let component: GestionCurso;
  let fixture: ComponentFixture<GestionCurso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionCurso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionCurso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
