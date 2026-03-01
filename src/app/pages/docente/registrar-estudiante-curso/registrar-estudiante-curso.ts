import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { CursoService } from '../../../services/cursos';
import { DocenteService } from '../../../services/docentes';
import { EstudiantesService } from '../../../services/estudiantes';
import { ProgramasAcademicosService } from '../../../services/programas-academicos';

type Course = {
  id: string;
  name: string;
 	code?: string;
};

type StudentOption = {
  id: string;
  code?: string;
  name: string;
  programaAcademico?: string;
};

type StudentRow = {
  asignacionId?: string;
  studentId: string;
  code: string;
  fullName: string;
  programaAcademico: string;
  docente: string;
  courseId: string;
  courseName: string;
  date: string;
};

@Component({
  selector: 'app-registrar-estudiante-curso',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-estudiante-curso.html',
  styleUrl: './registrar-estudiante-curso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrarEstudianteCurso {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly docenteService = inject(DocenteService);
  private readonly estudiantesService = inject(EstudiantesService);
  private readonly programasService = inject(ProgramasAcademicosService);

  readonly activeTab = signal<'registro' | 'registrados'>('registro');
  readonly cargando = signal<boolean>(false);

  readonly courses = signal<Course[]>([]);
  readonly allStudents = signal<StudentOption[]>([]);
  readonly programasAcademicos = signal<Array<{ id: string; nombre: string }>>([]);

  readonly selectedCourseId = signal<string>('');

  readonly availableStudents = computed(() => {
    const courseId = this.selectedCourseId();
    if (!courseId) return this.allStudents();

    const assigned = new Set(
      this.students()
        .filter((r) => r.courseId === courseId)
        .map((r) => r.studentId),
    );

    return this.allStudents().filter((s) => !assigned.has(s.id));
  });

  readonly students = signal<StudentRow[]>([]);
  readonly filterCourseId = signal<string>('all');
  readonly editingCode = signal<string | null>(null);

  readonly filteredStudents = computed(() => {
    const filterId = this.filterCourseId();
    const rows = this.students();
    if (filterId === 'all') return rows;
    return rows.filter((r) => r.courseId === filterId);
  });

  readonly form = this.fb.nonNullable.group({
    courseId: this.fb.nonNullable.control('', [Validators.required]),
    studentId: this.fb.nonNullable.control('', [Validators.required]),
    fullName: this.fb.nonNullable.control(''),
    programaAcademico: this.fb.nonNullable.control(''),
    studentCode: this.fb.nonNullable.control('', [Validators.required]),
    docente: this.fb.nonNullable.control(''),
  });

  constructor() {
    if (!this.isBrowser) return;
    this.cargarDesdeApi();
    this.prefillDocente();
  }

  setTab(tab: 'registro' | 'registrados') {
    this.activeTab.set(tab);
  }

  private prefillDocente(): void {
    const u = this.getUsuarioFromStorage();
    const nombre = String(u?.nombre ?? u?.name ?? u?.usuario?.nombre ?? '').trim();
    if (nombre) {
      this.form.patchValue({ docente: nombre });
    }
  }

  private getUsuarioFromStorage(): any | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private resolveDocenteId$() {
    const u = this.getUsuarioFromStorage();
    if (!u) return of(null);

    const direct = Number(u?.docente_id ?? u?.docenteId ?? u?.id_docente ?? u?.idDocente ?? u?.docente?.id);
    if (Number.isFinite(direct) && direct > 0) return of(direct);

    const correo = (u?.correo ?? u?.email ?? u?.usuario?.correo ?? u?.usuario?.email ?? '')
      .toString()
      .trim()
      .toLowerCase();
    const codigo = (u?.codigo ?? u?.user ?? u?.username ?? u?.usuario?.codigo ?? '').toString().trim();
    if (!correo && !codigo) return of(null);

    return this.docenteService.listar().pipe(
      take(1),
      map((rows: any) => (Array.isArray(rows) ? rows : [])),
      map((rows: any[]) => {
        const match = rows.find((d) => {
          const dc = (d?.correo ?? d?.email ?? '').toString().trim().toLowerCase();
          const cod = (d?.codigo ?? d?.user ?? d?.username ?? '').toString().trim();
          if (correo && dc && dc === correo) return true;
          if (codigo && cod && cod === codigo) return true;
          return false;
        });

        const id = Number(match?.id ?? match?.docente_id ?? match?.id_docente ?? match?.docenteId);
        return Number.isFinite(id) && id > 0 ? id : null;
      }),
      catchError(() => of(null)),
    );
  }

  private normalizeCurso(input: any): Course | null {
    const nested = input?.curso && typeof input.curso === 'object' ? input.curso : null;
    const src = nested ?? input;

    const idRaw = src?.id ?? src?.cursoId ?? src?.curso_id ?? src?.id_curso ?? input?.cursoId ?? input?.curso_id;
    const id = String(idRaw ?? '').trim();
    const name = String(
      src?.nombre ??
        src?.nombreCurso ??
        src?.nombre_curso ??
        src?.curso_nombre ??
        src?.cursoNombre ??
        src?.name ??
        input?.nombre ??
        input?.nombreCurso ??
        input?.nombre_curso ??
        '',
    ).trim();
    if (!id || !name) return null;

    const code = String(
      src?.codigo ?? src?.codigoCurso ?? src?.codigo_curso ?? input?.codigo ?? input?.codigoCurso ?? input?.codigo_curso ?? '',
    ).trim();
    return { id, name, ...(code ? { code } : {}) };
  }

  private normalizeStudentOption(input: any, programaNombreById: Map<string, string>): StudentOption | null {
    const idRaw = input?.id ?? input?.estudianteId ?? input?.estudiante_id ?? input?.id_estudiante ?? input?.idEstudiante;
    const id = String(idRaw ?? '').trim();
    if (!id) return null;

    const code = String(input?.codigo ?? input?.codigo_estudiante ?? input?.codigoEstudiante ?? '').trim();
    const name = String(
      input?.nombreCompleto ?? input?.nombre_completo ?? input?.nombre ?? input?.fullName ?? input?.nombres ?? '',
    ).trim();

    const programaId = String(
      input?.programaId ?? input?.programa_id ?? input?.programa ?? input?.programaAcademicoId ?? '',
    ).trim();
    const programaNombreDirecto = String(
      input?.programaNombre ?? input?.programa_nombre ?? input?.programaAcademico?.nombre ?? input?.programa_academico ?? '',
    ).trim();
    const programaAcademico = programaNombreDirecto || programaNombreById.get(programaId) || '';

    return {
      id,
      ...(code ? { code } : {}),
      name: name || '—',
      ...(programaAcademico ? { programaAcademico } : {}),
    };
  }

  private formatFecha(value: any): string {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toLocaleDateString('es-CO');
    const text = String(value).trim();
    if (!text) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(text);
    if (Number.isFinite(d.getTime())) return d.toLocaleDateString('es-CO');
    return text;
  }

  private toNumberId(id: string): number | null {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private cargarDesdeApi(): void {
    this.cargando.set(true);

    this.resolveDocenteId$()
      .pipe(
        take(1),
        switchMap((docenteId) => {
          const cursos$ = docenteId
            ? this.docenteService.listarCursosAsignados(docenteId)
            : this.cursoService.listar();

          return forkJoin({
            programas: this.programasService.listar().pipe(catchError(() => of([] as any[]))),
            estudiantes: this.estudiantesService.listar().pipe(catchError(() => of([] as any[]))),
            cursos: cursos$.pipe(catchError(() => of([] as any[]))),
          });
        }),
        catchError(() => of({ programas: [] as any[], estudiantes: [] as any[], cursos: [] as any[] })),
      )
      .subscribe({
        next: ({ programas, estudiantes, cursos }) => {
          const programasArr = Array.isArray(programas)
            ? programas
            : Array.isArray((programas as any)?.data)
              ? (programas as any).data
              : Array.isArray((programas as any)?.rows)
                ? (programas as any).rows
                : Array.isArray((programas as any)?.results)
                  ? (programas as any).results
                  : [];

          const estudiantesArr = Array.isArray(estudiantes)
            ? estudiantes
            : Array.isArray((estudiantes as any)?.data)
              ? (estudiantes as any).data
              : Array.isArray((estudiantes as any)?.rows)
                ? (estudiantes as any).rows
                : Array.isArray((estudiantes as any)?.results)
                  ? (estudiantes as any).results
                  : [];

          const cursosArr = Array.isArray(cursos)
            ? cursos
            : Array.isArray((cursos as any)?.data)
              ? (cursos as any).data
              : Array.isArray((cursos as any)?.rows)
                ? (cursos as any).rows
                : Array.isArray((cursos as any)?.results)
                  ? (cursos as any).results
                  : [];

          const programasList = programasArr
            .map((p: any) => ({
              id: String(p?.id ?? p?.programaId ?? p?.programa_id ?? '').trim(),
              nombre: String(p?.nombre ?? p?.programa ?? p?.name ?? '').trim(),
            }))
            .filter((p: any) => !!p.id);

          this.programasAcademicos.set(programasList.filter((p: any) => !!p.nombre));

          const programaNombreById = new Map<string, string>(
            programasList.map((p: any) => [p.id, p.nombre || '—'] as const),
          );

          const cursosList = cursosArr
            .map((c: any) => this.normalizeCurso(c))
            .filter((c: Course | null): c is Course => !!c);

          const estudiantesList = estudiantesArr
            .map((e: any) => this.normalizeStudentOption(e, programaNombreById))
            .filter((e: StudentOption | null): e is StudentOption => !!e);

          this.courses.set(cursosList);
          this.allStudents.set(estudiantesList);

          if (cursosList.length) {
            this.cargarAsignaciones(cursosList);
          } else {
            this.students.set([]);
            this.cargando.set(false);
          }
        },
        error: () => {
          this.courses.set([]);
          this.allStudents.set([]);
          this.programasAcademicos.set([]);
          this.students.set([]);
          this.cargando.set(false);
        },
      });
  }

  private cargarAsignaciones(cursos: Course[]): void {
    const calls = cursos.map((c) => {
      const idNum = this.toNumberId(c.id);
      if (!idNum) return of({ course: c, rows: [] as any[] });
      return this.estudiantesService
        .listarPorCurso(idNum)
        .pipe(
          catchError(() => of([] as any[])),
          map((rows: any) => ({ course: c, rows: Array.isArray(rows) ? rows : [] })),
        );
    });

    forkJoin(calls.length ? calls : [of({ course: null as any, rows: [] as any[] })])
      .pipe(take(1), catchError(() => of([] as any)))
      .subscribe({
        next: (results: Array<{ course: Course; rows: any[] }>) => {
          const docenteForm = this.form.controls.docente.value.toString().trim();

		  const programaByStudentId = new Map(
			this.allStudents()
				.filter((s) => !!s.id)
				.map((s) => [s.id, String(s.programaAcademico ?? '').trim()] as const),
		  );

          const rows = results.flatMap((r) => {
            const course = r.course;
            const courseName = course?.name ?? '—';
            const courseId = course?.id ?? '';

            return (Array.isArray(r.rows) ? r.rows : []).reduce<StudentRow[]>((acc, x: any) => {
              const studentId = String(
                x?.estudiante_id ?? x?.estudianteId ?? x?.id_estudiante ?? x?.idEstudiante ?? x?.estudiante?.id ?? x?.id,
              ).trim();
              if (!studentId) return acc;

              const code = String(x?.codigo ?? x?.codigo_estudiante ?? x?.codigoEstudiante ?? x?.estudiante?.codigo ?? '').trim();
              const fullName = String(
                x?.nombre_completo ?? x?.nombreCompleto ?? x?.nombre ?? x?.fullName ?? x?.estudiante?.nombre_completo ?? x?.estudiante?.nombre,
              ).trim();

              const programaAcademicoFromApi = String(
                x?.programa ??
                  x?.programa_nombre ??
                  x?.programaNombre ??
                  x?.programaAcademico ??
                  x?.estudiante?.programa_nombre ??
                  x?.estudiante?.programa ??
                  '',
              ).trim();

			  const programaAcademico =
				(programaAcademicoFromApi && programaAcademicoFromApi !== '-' ? programaAcademicoFromApi : '') ||
				(programaByStudentId.get(studentId) ?? '');

              const docente = String(x?.docente ?? x?.docente_nombre ?? x?.docenteNombre ?? docenteForm ?? '').trim();

              const fechaRaw = x?.fechaRegistro ?? x?.fecha_registro ?? x?.createdAt ?? x?.created_at ?? x?.fecha;
              const date = this.formatFecha(fechaRaw);

              const asignacionId = String(
                x?.id_asignacion ?? x?.asignacion_id ?? x?.idAsignacion ?? x?.id_estudiante_curso ?? x?.estudiante_curso_id ?? '',
              ).trim();

              acc.push({
                ...(asignacionId ? { asignacionId } : {}),
                studentId,
                code: code || '—',
                fullName: fullName || '—',
                programaAcademico,
                docente,
                courseId,
                courseName,
                date,
              });
              return acc;
            }, []);
          });

          this.students.set(rows);
          this.cargando.set(false);
        },
        error: () => {
          this.students.set([]);
          this.cargando.set(false);
        },
      });
  }

  onCourseChange(courseId: string) {
    this.selectedCourseId.set(courseId);
    this.form.patchValue({ studentId: '' });
  }

  onStudentChange(studentId: string) {
    const student = this.allStudents().find((s) => s.id === studentId);
    if (!student) return;
    this.form.patchValue({
      studentCode: student.code ?? this.form.controls.studentCode.value,
      fullName: student.name,
      ...(student.programaAcademico ? { programaAcademico: student.programaAcademico } : {}),
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const estudianteIdNum = this.toNumberId(value.studentId);
    const cursoIdNum = this.toNumberId(value.courseId);
    if (!estudianteIdNum || !cursoIdNum) return;

    this.cargando.set(true);
    this.estudiantesService
      .asignarCurso({ estudianteId: estudianteIdNum, cursoId: cursoIdNum })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => {
        this.editingCode.set(null);

        this.form.reset({
          courseId: '',
          studentId: '',
          fullName: '',
          programaAcademico: '',
          studentCode: '',
          docente: value.docente ?? '',
        });
        this.selectedCourseId.set('');

        const cursosList = this.courses();
        if (cursosList.length) {
          this.cargarAsignaciones(cursosList);
        } else {
          this.cargando.set(false);
        }

        this.activeTab.set('registrados');
      });
  }

  cancel() {
    this.editingCode.set(null);
    this.form.reset({
      courseId: '',
      studentId: '',
      fullName: '',
      programaAcademico: '',
      studentCode: '',
      docente: '',
    });
    this.selectedCourseId.set('');

    this.activeTab.set('registro');
  }

  setFilter(courseId: string) {
    this.filterCourseId.set(courseId);
  }

  edit(code: string) {
    const row = this.students().find((r) => r.code === code);
    if (!row) return;
    this.editingCode.set(code);
    this.selectedCourseId.set(row.courseId);
    this.form.setValue({
      courseId: row.courseId,
      studentId: row.studentId,
      fullName: row.fullName,
      programaAcademico: row.programaAcademico,
      studentCode: row.code,
      docente: row.docente,
    });

    this.activeTab.set('registro');
  }

  remove(code: string) {
    const row = this.students().find((r) => r.code === code);
    if (!row) return;

    const asignacionIdNum = row.asignacionId ? this.toNumberId(row.asignacionId) : null;
    if (!asignacionIdNum) {
      this.students.update((rows) => rows.filter((r) => r.code !== code));
      if (this.editingCode() === code) {
        this.cancel();
      }
      return;
    }

    this.cargando.set(true);
    this.estudiantesService
      .eliminarAsignacionCurso(asignacionIdNum)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => {
        if (this.editingCode() === code) this.cancel();
        const cursosList = this.courses();
        if (cursosList.length) {
          this.cargarAsignaciones(cursosList);
        } else {
          this.cargando.set(false);
        }
      });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
