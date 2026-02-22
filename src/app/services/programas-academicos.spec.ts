import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ProgramasAcademicosService } from './programas-academicos';

describe('ProgramasAcademicosService', () => {
  let service: ProgramasAcademicosService;

  beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
		});
    service = TestBed.inject(ProgramasAcademicosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
