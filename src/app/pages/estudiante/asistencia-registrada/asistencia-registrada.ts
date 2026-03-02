import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, from, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, take, toArray } from 'rxjs/operators';
import { AsistenciaService } from '../../../services/asistencia';
import { CursoService } from '../../../services/cursos';
import { EstudiantesService } from '../../../services/estudiantes';

type CursoOption = { id: number; nombre: string; codigo?: string };

type HistorialRow = {
  id_asistencia?: number;
  fecha?: string;
  hora_inicio?: string;
  hora_fin?: string | null;
  estado?: string;
  estudiante_id?: number;
  codigo?: string;
  nombre_completo?: string;
  curso?: string;
  curso_id?: number;
};

@Component({
  selector: 'app-asistencia-registrada',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './asistencia-registrada.html',
  styleUrl: './asistencia-registrada.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsistenciaRegistrada {
  private readonly estudiantesService = inject(EstudiantesService);
  private readonly asistenciaService = inject(AsistenciaService);
  private readonly cursoService = inject(CursoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly cargandoCursos = signal(false);
  readonly cursos = signal<CursoOption[]>([]);

  readonly cargandoHistorial = signal(false);
  readonly historial = signal<HistorialRow[]>([]);

  readonly toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private currentStudent?: { estudianteId: number; codigo?: string; email?: string };

  readonly form = new FormGroup({
    cursoId: new FormControl<string>('todos', { nonNullable: true }),
    busqueda: new FormControl<string>('', { nonNullable: true }),
  });

  readonly selectedCursoId = signal<string>('todos');
  readonly busqueda = signal<string>('');

  readonly historialFiltrado = computed(() => {
    const q = (this.busqueda() || '').trim().toLowerCase();
    const selected = this.selectedCursoId();
    const cursoId = selected === 'todos' ? null : Number(selected);

    let data = [...this.historial()];

    if (cursoId && Number.isFinite(cursoId)) {
      data = data.filter((x) => Number(x?.curso_id) === cursoId);
    }

    if (q) {
      data = data.filter((x) => {
        const codigo = (x?.codigo ?? '').toString().toLowerCase();
        const nombre = (x?.nombre_completo ?? '').toString().toLowerCase();
        const curso = (x?.curso ?? '').toString().toLowerCase();
        const estado = (x?.estado ?? '').toString().toLowerCase();
        return codigo.includes(q) || nombre.includes(q) || curso.includes(q) || estado.includes(q);
      });
    }

    return data;
  });

  constructor() {
    this.form.controls.cursoId.disable({ emitEvent: false });

    this.form.controls.busqueda.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.busqueda.set(value ?? ''));

    this.form.controls.cursoId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const v = value ?? 'todos';
        this.selectedCursoId.set(v);
        this.cargarHistorial();
      });
  }

  ngOnInit() {
    this.cargarCursos();
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }

  private getCurrentUser(): any {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private resolveEstudianteId$() {
    if (!this.isBrowser) return of(null);
    const user = this.getCurrentUser();
    const rol = (user?.rol ?? user?.role ?? user?.tipo ?? user?.perfil ?? '').toString().trim().toLowerCase();

    const explicit = Number(
      user?.estudianteId ??
        user?.id_estudiante ??
        user?.idEstudiante ??
        user?.estudiante_id ??
        user?.estudiante?.id,
    );
    if (Number.isFinite(explicit) && explicit > 0) return of(explicit);

    const correo = (
      user?.correo ??
        user?.email ??
        user?.mail ??
        user?.usuario?.correo ??
        user?.usuario?.email ??
        ''
    )
      .toString()
      .trim()
      .toLowerCase();
    const codigo = (
      user?.codigo ??
        user?.codigoEstudiante ??
        user?.code ??
        user?.user ??
        user?.username ??
        user?.usuario?.codigo ??
        ''
    )
      .toString()
      .trim();

    if (rol && !rol.includes('estudiante')) return of(null);
    if (!correo && !codigo) {
      const maybe = Number(user?.id);
      return Number.isFinite(maybe) && maybe > 0 ? of(maybe) : of(null);
    }

    return this.estudiantesService.listar().pipe(
      take(1),
      map((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const match = list.find((r: any) => {
          const rCorreo = (r?.correo ?? r?.email ?? r?.mail ?? '').toString().trim().toLowerCase();
          const rCodigo = (r?.codigo ?? r?.codigoEstudiante ?? r?.code ?? r?.user ?? r?.username ?? '')
            .toString()
            .trim();

          if (correo && rCorreo && rCorreo === correo) return true;
          if (codigo && rCodigo && rCodigo === codigo) return true;
          return false;
        });

        const id = Number(
          match?.id ??
            match?.estudianteId ??
            match?.id_estudiante ??
            match?.idEstudiante ??
            match?.estudiante_id,
        );
        if (Number.isFinite(id) && id > 0) return id;
        const maybe = Number(user?.id);
        return Number.isFinite(maybe) && maybe > 0 ? maybe : null;
      }),
      catchError(() => of(null)),
    );
  }

  private getStudentIdentityHint(): { codigo?: string; email?: string } {
    const user = this.getCurrentUser();
    if (!user) return {};
    const email = (
      user?.correo ?? user?.email ?? user?.mail ?? user?.usuario?.correo ?? user?.usuario?.email ?? ''
    )
      .toString()
      .trim()
      .toLowerCase();
    const codigo = (
      user?.codigo ?? user?.codigoEstudiante ?? user?.code ?? user?.user ?? user?.username ?? user?.usuario?.codigo ?? ''
    )
      .toString()
      .trim();
    return { ...(codigo ? { codigo } : {}), ...(email ? { email } : {}) };
  }

  private asistenciaMatchesStudent(a: any, s: { estudianteId: number; codigo?: string; email?: string }): boolean {
    const aid = Number(a?.estudiante_id ?? a?.id_estudiante ?? a?.estudianteId ?? a?.idEstudiante);
    if (Number.isFinite(aid) && aid > 0 && aid === s.estudianteId) return true;

    const acode = (a?.codigo ?? a?.person ?? a?.code ?? a?.user ?? a?.username)?.toString?.().trim?.();
    if (s.codigo && acode && String(acode) === s.codigo) return true;

    const aemail = (a?.correo ?? a?.email ?? a?.mail)?.toString?.().trim?.().toLowerCase?.();
    if (s.email && aemail && String(aemail) === s.email) return true;

    return false;
  }

  private filterCursosConAsistencia(courses: CursoOption[], student: { estudianteId: number; codigo?: string; email?: string }) {
    if (!courses.length) return of([] as CursoOption[]);

    return from(courses).pipe(
      mergeMap(
        (curso) =>
          this.asistenciaService.listarAsistenciasPorCurso(curso.id).pipe(
            take(1),
            map((res: any) => {
              const asistencias = Array.isArray(res?.asistencias) ? res.asistencias : [];
              const anyMine = asistencias.some((a: any) => this.asistenciaMatchesStudent(a, student));
              return anyMine ? curso : null;
            }),
            catchError(() => of(null)),
          ),
        4,
      ),
      toArray(),
      map((arr) => arr.filter((x): x is CursoOption => !!x)),
    );
  }

  private scanCursosConAsistencia(student: { estudianteId: number; codigo?: string; email?: string }) {
    return this.cursoService.listar().pipe(
      take(1),
      map((rows: any) => (Array.isArray(rows) ? rows : [])),
      map((raw: any[]) =>
        raw
          .map((c: any) => this.normalizeCurso(c))
          .filter((c: CursoOption | null): c is CursoOption => !!c),
      ),
      switchMap((courses: CursoOption[]) => this.filterCursosConAsistencia(courses, student)),
    );
  }

  private normalizeCurso(input: any): CursoOption | null {
    if (!input || typeof input !== 'object') return null;

    const idCandidate = input.id ?? input.cursoId ?? input.curso_id ?? input.id_curso;
    const id = Number(idCandidate);
    if (!Number.isFinite(id) || id <= 0) return null;

    const nombre = (
      input.nombre ??
        input.nombreCurso ??
        input.nombre_curso ??
        input.curso ??
        input.curso_nombre
    )
      ?.toString?.()
      .trim?.();
    if (!nombre) return null;

    const codigo = (input.codigo ?? input.codigoCurso ?? input.codigo_curso)?.toString?.().trim?.();
    return { id, nombre, ...(codigo ? { codigo } : {}) };
  }

  private extractTime(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toTimeString().slice(0, 8);
    }
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
    const hhmmss = text.match(/\b([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);
    if (hhmmss?.[0]) {
      const t = hhmmss[0];
      return t.length === 5 ? `${t}:00` : t;
    }
    const isoOrSql = text.match(/\b([01]\d|2[0-3]):[0-5]\d:[0-5]\d\b/);
    return isoOrSql?.[0] ?? undefined;
  }

  formatFecha(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value).trim();
    if (!text) return '—';
    if (text.includes('T')) return text.split('T')[0] || text;
    if (text.includes(' ')) {
      const first = text.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(text);
    if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
    return text;
  }

  cargarCursos() {
    if (!this.isBrowser) return;

    this.cargandoCursos.set(true);
    this.form.controls.cursoId.disable({ emitEvent: false });

    const onOk = (data: any) => {
      const raw = Array.isArray(data) ? data : Array.isArray(data?.cursos) ? data.cursos : [];
      const normalized: CursoOption[] = raw
        .map((c: any) => this.normalizeCurso(c))
        .filter((c: CursoOption | null): c is CursoOption => !!c);
      this.cursos.set(normalized);

      if (normalized.length) {
        this.form.controls.cursoId.enable({ emitEvent: false });
      } else {
        this.form.controls.cursoId.disable({ emitEvent: false });
      }

      const selected = this.form.controls.cursoId.value;
      if (selected !== 'todos') {
        const id = Number(selected);
        if (!normalized.some((c) => c.id === id)) {
          this.form.controls.cursoId.setValue('todos', { emitEvent: false });
          this.selectedCursoId.set('todos');
        }
      }

      this.cargarHistorial();
      this.cargandoCursos.set(false);
    };

    const onErr = () => {
      this.cursos.set([]);
      this.form.controls.cursoId.setValue('todos', { emitEvent: false });
      this.selectedCursoId.set('todos');
      this.form.controls.cursoId.disable({ emitEvent: false });
      this.historial.set([]);
      this.cargandoCursos.set(false);
      this.toast('No se pudieron cargar los cursos');
    };

    const hint = this.getStudentIdentityHint();

    this.resolveEstudianteId$()
      .pipe(
        take(1),
        switchMap((id) => {
          if (!id) return of([]);

          this.currentStudent = { estudianteId: id, ...hint };

          return this.estudiantesService.listarCursosAsignados(id).pipe(
            take(1),
            catchError(() => of([])),
            switchMap((assigned: any) => {
              const raw = Array.isArray(assigned)
                ? assigned
                : Array.isArray((assigned as any)?.cursos)
                  ? (assigned as any).cursos
                  : [];
              if (raw.length) {
                const normalized = raw
                  .map((c: any) => this.normalizeCurso(c))
                  .filter((c: CursoOption | null): c is CursoOption => !!c);
                return this.filterCursosConAsistencia(normalized, { estudianteId: id, ...hint });
              }
              return this.scanCursosConAsistencia({ estudianteId: id, ...hint });
            }),
          );
        }),
      )
      .subscribe({ next: onOk, error: onErr });
  }

  cargarHistorial() {
    if (!this.isBrowser) return;

    const student = this.currentStudent;
    if (!student) {
      this.historial.set([]);
      return;
    }

    const selected = this.selectedCursoId();
    const cursoId = selected === 'todos' ? null : Number(selected);

    if (selected !== 'todos' && (!Number.isFinite(cursoId as any) || (cursoId as number) <= 0)) {
      this.historial.set([]);
      return;
    }

    const cursos = this.cursos();
    if (selected === 'todos' && !cursos.length) {
      this.historial.set([]);
      return;
    }

    this.cargandoHistorial.set(true);

    const toRows = (curso: CursoOption, res: any): HistorialRow[] => {
      const asistenciasRaw = Array.isArray(res?.asistencias) ? res.asistencias : [];
      const asistencias = asistenciasRaw.filter((a: any) => this.asistenciaMatchesStudent(a, student));
      return asistencias.map((a: any) => {
        const nombreCompleto = a?.nombre_completo ?? a?.nombreCompleto ?? a?.nombre ?? a?.estudiante_nombre;

        const horaInicioRaw = a?.hora_inicio ?? a?.horaInicio;
        const horaInicio =
          this.extractTime(horaInicioRaw) ?? (typeof horaInicioRaw === 'string' ? horaInicioRaw : undefined);

        const horaFin = a?.hora_fin ?? a?.horaFin ?? a?.hora_salida ?? a?.horaSalida ?? a?.hora_final ?? a?.horaFinal;
        const horaFinText = this.extractTime(horaFin) ?? (typeof horaFin === 'string' ? horaFin : undefined);

        return {
          ...a,
          nombre_completo: nombreCompleto,
          hora_inicio: horaInicio,
          hora_fin: horaFinText,
          curso: `${curso.codigo ? curso.codigo + ' - ' : ''}${curso.nombre}`,
          curso_id: curso.id,
        };
      });
    };

    const onFail = () => {
      this.historial.set([]);
      this.cargandoHistorial.set(false);
      this.toast('No se pudo cargar el historial');
    };

    if (selected !== 'todos') {
      const curso = cursos.find((c) => c.id === (cursoId as number)) ?? ({ id: cursoId as number, nombre: '' } as CursoOption);
      this.asistenciaService
        .listarAsistenciasPorCurso(curso.id)
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            this.historial.set(toRows(curso, res));
            this.cargandoHistorial.set(false);
          },
          error: onFail,
        });
      return;
    }

    const requests = cursos.map((c) =>
      this.asistenciaService.listarAsistenciasPorCurso(c.id).pipe(
        take(1),
        map((res) => toRows(c, res)),
        catchError(() => of([] as HistorialRow[])),
      ),
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (groups) => {
          const merged = (groups ?? []).reduce(
            (acc: HistorialRow[], curr: HistorialRow[]) => acc.concat(curr),
            [],
          );
          merged.sort((a, b) => {
            const ka = `${a?.fecha ?? ''} ${a?.hora_inicio ?? ''}`.trim();
            const kb = `${b?.fecha ?? ''} ${b?.hora_inicio ?? ''}`.trim();
            return kb.localeCompare(ka);
          });

          this.historial.set(merged);
          this.cargandoHistorial.set(false);
        },
        error: onFail,
      });
  }

  toast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 2200);
  }

}
