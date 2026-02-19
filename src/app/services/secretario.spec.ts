import { TestBed } from '@angular/core/testing';

import { Secretario } from './secretario';

describe('Secretario', () => {
  let service: Secretario;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Secretario);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
