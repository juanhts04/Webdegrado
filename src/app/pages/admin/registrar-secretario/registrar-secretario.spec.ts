import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarSecretario } from './registrar-secretario';

describe('RegistrarSecretario', () => {
  let component: RegistrarSecretario;
  let fixture: ComponentFixture<RegistrarSecretario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarSecretario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarSecretario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
