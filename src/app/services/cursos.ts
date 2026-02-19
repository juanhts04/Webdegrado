import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class CursoService {

  private apiUrl = environment.apiUrl; // https://juanbiometric.duckdns.org

  private readonly cursosChangedSubject = new Subject<void>();
  cursosChanged$ = this.cursosChangedSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** 🔹 LISTAR cursos */
  listar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/cursos`);
  }

  /** 🔹 REGISTRAR curso */
  registrar(curso: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cursos`, curso).pipe(
      tap(() => this.cursosChangedSubject.next())
    );
  }

  /** 🔹 ELIMINAR curso */
  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cursos/${id}`).pipe(
      tap(() => this.cursosChangedSubject.next())
    );
  }

  /** 🔹 OBTENER curso por ID (opcional) */
  obtener(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cursos/${id}`);
  }

  /** 🔹 ACTUALIZAR curso (opcional) */
  actualizar(id: number, curso: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/cursos/${id}`, curso).pipe(
      tap(() => this.cursosChangedSubject.next())
    );
  }
}
