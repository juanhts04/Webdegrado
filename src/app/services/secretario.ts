import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class Secretario {

   private apiUrl = environment.apiUrl; // https://juanbiometric.duckdns.org

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR secretarios */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/secretarios`);
  }

  /** 🔹 REGISTRAR secretario */
  registrar(secretario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/secretarios`, secretario);
  }

  /** 🔹 ELIMINAR secretario */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/secretarios/${id}`);
  }

  /** 🔹 OBTENER secretario por ID */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/secretarios/${id}`);
  }

  /** 🔹 ACTUALIZAR secretario */
  actualizar(id: number, secretario: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/secretarios/${id}`, secretario);
  }

}
