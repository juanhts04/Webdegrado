import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class ProgramasAcademicosService {

  private apiUrl = environment.apiUrl; // https://juanbiometric.duckdns.org

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR programas académicos */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/programas-academicos`);
  }

  /** 🔹 REGISTRAR programa académico */
  registrar(programa: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/programas-academicos`, programa);
  }

  /** 🔹 ELIMINAR programa académico */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/programas-academicos/${id}`);
  }

  /** 🔹 OBTENER programa académico por ID */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/programas-academicos/${id}`);
  }

  /** 🔹 ACTUALIZAR programa académico */
  actualizar(id: number, programa: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/programas-academicos/${id}`, programa);
  }
}
