import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class AsistenciaService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** 🔹 Registrar asistencia por reconocimiento facial */
  registrarAsistencia(curso_id: number, person: string) {
    return this.http.post(`${this.apiUrl}/asistencia`, {
      curso_id,
      person
    });
  }

  /** 🔹 Listar asistencias registradas por curso */
  listarAsistenciasPorCurso(curso_id: number) {
    return this.http.get<{
      curso_id: number;
      total: number;
      asistencias: {
        id_asistencia: number;
        fecha: string;
        hora_inicio: string;
        hora_fin?: string | null;
        estado: string;
        estudiante_id: number;
        codigo: string;
        nombre_completo: string;
        nombre?: string;
        updated_at?: string;
      }[];
    }>(`${this.apiUrl}/asistencia/curso/${curso_id}`);
  }

  registrarSalida(curso_id: number, person: string) {
  return this.http.post(`${this.apiUrl}/asistencia/salida`, {
    curso_id,
    person
  });
}


}
