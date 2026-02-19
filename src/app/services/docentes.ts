import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class DocenteService {

  private apiUrl = environment.apiUrl; // https://juanbiometric.duckdns.org

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR docentes */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/docentes`);
  }

  /** 🔹 REGISTRAR docente */
  registrar(docente: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/docentes`, docente);
  }

  /** 🔹 ELIMINAR docente */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/docentes/${id}`);
  }

  /** 🔹 OBTENER docente por ID */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/docentes/${id}`);
  }

  /** 🔹 ACTUALIZAR docente */
  actualizar(id: number, docente: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/docentes/${id}`, docente);
  }

  asignarCurso(data: { docenteId: number; cursoId: number }): Observable<any> {
  return this.http.post(`${this.apiUrl}/asignar-docente-curso`, data);
}

  /** 🔹 LISTAR cursos asignados a un docente */
  listarCursosAsignados(docenteId: number): Observable<any[]> {
    // Actualizado para usar el endpoint /cursos-por-docente/:docenteId
    return this.http.get<any[]>(`${this.apiUrl}/cursos-por-docente/${docenteId}`);
  }


}
