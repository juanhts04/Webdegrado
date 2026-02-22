import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DocenteService } from './docentes';

describe('DocenteService', () => {
  let service: DocenteService;

  beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
		});
    service = TestBed.inject(DocenteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
