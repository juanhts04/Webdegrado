import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class HorarioService {

  private apiUrl = environment.apiUrl; // https://juanbiometric.duckdns.org

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR horarios */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/horarios`);
  }

  /** 🔹 REGISTRAR horario */
  registrar(horario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/horarios`, horario);
  }

  /** 🔹 ELIMINAR horario */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/horarios/${id}`);
  }

  /** 🔹 OBTENER horario por ID */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/horarios/${id}`);
  }

  /** 🔹 ACTUALIZAR horario */
  actualizar(id: number, horario: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/horarios/${id}`, horario);
  }
}
