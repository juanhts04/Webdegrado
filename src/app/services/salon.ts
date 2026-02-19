import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class SalonService {

  private apiUrl = environment.apiUrl; // https://juanbiometric.duckdns.org

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR salones */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/salones`);
  }

  /** 🔹 REGISTRAR salón */
  registrar(salon: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/salones`, salon);
  }

  /** 🔹 ELIMINAR salón */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/salones/${id}`);
  }

  /** 🔹 OBTENER salón por ID */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/salones/${id}`);
  }

  /** 🔹 ACTUALIZAR salón */
  actualizar(id: number, salon: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/salones/${id}`, salon);
  }
}
