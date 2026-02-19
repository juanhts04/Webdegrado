import { TestBed } from '@angular/core/testing';

import { Salon } from './salon';

describe('Salon', () => {
  let service: Salon;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Salon);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
