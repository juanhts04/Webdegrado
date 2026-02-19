import { TestBed } from '@angular/core/testing';

import { ReconocimientoFacialService } from './reconocimiento-facial-service';

describe('ReconocimientoFacialService', () => {
  let service: ReconocimientoFacialService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReconocimientoFacialService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
