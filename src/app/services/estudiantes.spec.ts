import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { EstudiantesService } from './estudiantes';

describe('EstudiantesService', () => {
  let service: EstudiantesService;

  beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
		});
    service = TestBed.inject(EstudiantesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
