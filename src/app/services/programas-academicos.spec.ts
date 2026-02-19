import { TestBed } from '@angular/core/testing';

import { ProgramasAcademicos } from './programas-academicos';

describe('ProgramasAcademicos', () => {
  let service: ProgramasAcademicos;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProgramasAcademicos);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
