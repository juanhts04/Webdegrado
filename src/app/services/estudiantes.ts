import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class EstudiantesService {

  private apiExpress = environment.apiExpress;
  // https://juanbiometric.duckdns.org/api2

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR estudiantes */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiExpress}/estudiantes`);
  }

  /** 🔹 REGISTRAR estudiante */
  registrar(estudiante: any): Observable<any> {
    return this.http.post(`${this.apiExpress}/estudiantes`, estudiante);
  }

  /** 🔹 ELIMINAR estudiante */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiExpress}/estudiantes/${id}`);
  }

  /** 🔹 OBTENER estudiante por ID */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiExpress}/estudiantes/${id}`);
  }

  /** 🔹 ACTUALIZAR estudiante */
  actualizar(id: number, estudiante: any): Observable<any> {
    return this.http.put(`${this.apiExpress}/estudiantes/${id}`, estudiante);
  }

  /** 🔹 LISTAR programas académicos */
 listarProgramas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/programas-academicos`);
  }

    asignarCurso(data: { estudianteId: number; cursoId: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/asignar-estudiante-curso`, data);
  }

  listarCursosAsignados(estudianteId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/estudiantes/${estudianteId}/cursos`
    );
  }

 /** 🔹 LISTAR estudiantes asignados a un curso */
listarPorCurso(cursoId: number): Observable<any[]> {
  return this.http.get<any[]>(
    `${this.apiUrl}/estudiantes-por-curso/${cursoId}`
  );
}


}
