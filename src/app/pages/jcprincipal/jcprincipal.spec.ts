import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Jcprincipal } from './jcprincipal';

describe('Jcprincipal', () => {
  let component: Jcprincipal;
  let fixture: ComponentFixture<Jcprincipal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Jcprincipal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Jcprincipal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
