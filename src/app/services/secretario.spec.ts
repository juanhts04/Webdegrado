import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { Secretario } from './secretario';

describe('Secretario', () => {
  let service: Secretario;

  beforeEach(() => {
    TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
		});
    service = TestBed.inject(Secretario);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
