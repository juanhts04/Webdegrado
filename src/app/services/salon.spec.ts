import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { SalonService } from './salon';

describe('SalonService', () => {
  let service: SalonService;

  beforeEach(() => {
    TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
		});
    service = TestBed.inject(SalonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
