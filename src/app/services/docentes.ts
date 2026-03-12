import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
    return this.http.put(`${this.apiUrl}/docentes/${id}`, docente).pipe(
      catchError(() => this.http.put(`${this.apiUrl}/docente/${id}`, docente)),
    );
  }

  asignarCurso(data: { docenteId: number; cursoId: number }): Observable<any> {
		return this.http.post(`${this.apiUrl}/asignar-docente-curso`, data);
	}

  /** 🔹 ACTUALIZAR asignación docente-curso */
  actualizarAsignacion(asignacionId: number, data: { docenteId: number; cursoId: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/asignar-docente-curso/${asignacionId}`, data);
  }

  /** 🔹 ELIMINAR asignación docente-curso */
  eliminarAsignacion(asignacionId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/asignar-docente-curso/${asignacionId}`);
  }

  /** 🔹 LISTAR cursos asignados a un docente */
  listarCursosAsignados(docenteId: number): Observable<any[]> {
    // Compatibilidad: distintos backends exponen el recurso en rutas diferentes.
    return this.http.get<any[]>(`${this.apiUrl}/cursos-por-docente/${docenteId}`).pipe(
      catchError(() => this.http.get<any[]>(`${this.apiUrl}/docentes/${docenteId}/cursos`)),
      catchError(() => this.http.get<any[]>(`${this.apiUrl}/cursos/docente/${docenteId}`)),
      catchError(() => this.http.get<any[]>(`${this.apiUrl}/docente/${docenteId}/cursos`)),
    );
  }

  /** 🔹 LISTAR docentes asignados a un curso (para fallbacks) */
  listarPorCurso(cursoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/docentes-por-curso/${cursoId}`).pipe(
      catchError(() => this.http.get<any[]>(`${this.apiUrl}/cursos/${cursoId}/docentes`)),
      catchError(() => this.http.get<any[]>(`${this.apiUrl}/curso/${cursoId}/docentes`)),
    );
  }

  /** 🔹 LISTAR asignaciones docente-curso (si el backend lo expone) */
  listarAsignaciones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/asignar-docente-curso`);
  }


}
