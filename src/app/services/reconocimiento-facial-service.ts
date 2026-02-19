import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class ReconocimientoFacialService {

  private api = environment.apiFaceservice; // Face API
  private apiUrl = environment.apiUrl;      // API principal

  constructor(private http: HttpClient) {}

  /**
   * Detecta un rostro sin reconocerlo
   * Útil para loop de detección rápido
   */
  detectarRostro(imagen: Blob): Observable<any> {
    const formData = new FormData();
    formData.append('image', imagen, 'face.jpg');

    return this.http.post(`${this.api}/detect`, formData);
  }

  /**
   * Reconoce un rostro comparándolo con la base de datos
   * Llamar solo cuando el rostro está estable
   */
  reconocerRostro(imagen: Blob): Observable<any> {
    const formData = new FormData();
    formData.append('image', imagen, 'face.jpg');

    return this.http.post(`${this.api}/recognize`, formData);
  }

  /**
   * Registrar asistencia de un estudiante
   */
  registrarAsistencia(estudianteId: number) {
    return this.http.post(`${this.apiUrl}/asistencias`, {
      estudianteId
    });
  }
}
