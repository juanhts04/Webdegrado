import { TestBed } from '@angular/core/testing';

import { Docentes } from './docentes';

describe('Docentes', () => {
  let service: Docentes;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Docentes);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
