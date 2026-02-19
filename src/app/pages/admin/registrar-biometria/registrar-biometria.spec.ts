import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarBiometria } from './registrar-biometria';

describe('RegistrarBiometria', () => {
  let component: RegistrarBiometria;
  let fixture: ComponentFixture<RegistrarBiometria>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarBiometria]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarBiometria);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
