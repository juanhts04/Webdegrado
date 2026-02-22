import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AsistenciaService } from '../../../services/asistencia';
import { CursoService } from '../../../services/cursos';
import { DocenteService } from '../../../services/docentes';

type AsistenciaRow = {
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

type CursoOption = { id: number; nombre: string; codigo?: string };

type PerfilRol = 'estudiante' | 'docente' | 'secretario' | 'admin' | 'desconocido';

@Component({
  selector: 'app-supervisar-asistencia',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './supervisar-asistencia.html',
  styleUrl: './supervisar-asistencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisarAsistencia {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly asistenciaService = inject(AsistenciaService);
  private readonly docenteService = inject(DocenteService);

  readonly activeTab = signal<'supervisar' | 'registrados'>('supervisar');

  readonly cargandoCursos = signal<boolean>(false);
  readonly cargandoAsistencias = signal<boolean>(false);

  readonly cursosDisponibles = signal<CursoOption[]>([]);
  readonly asistencias = signal<AsistenciaRow[]>([]);

  readonly busquedaRegistradas = signal<string>('');
  readonly filtroEstado = signal<'todos' | 'Presente' | 'Ausente'>('todos');

  readonly filtrosForm = this.fb.nonNullable.group({
    curso: this.fb.nonNullable.control('todos'),
    fecha: this.fb.nonNullable.control(''),
  });

  readonly asistenciasFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const q = this.busquedaRegistradas().trim().toLowerCase();
    const fecha = this.filtrosForm.controls.fecha.value.toString().trim();

    let data = [...this.asistencias()];

    if (fecha) {
      data = data.filter((a) => this.formatFecha(a?.fecha) === fecha);
    }

    if (estado !== 'todos') {
      data = data.filter((a) => (a?.estado ?? '').toString().toLowerCase() === estado.toLowerCase());
    }

    if (q) {
      data = data.filter((a) => {
        const codigo = (a?.codigo ?? '').toString().toLowerCase();
        const nombre = (a?.nombre_completo ?? '').toString().toLowerCase();
        const cursoTxt = (a?.curso ?? '').toString().toLowerCase();
        const estadoTxt = (a?.estado ?? '').toString().toLowerCase();
        return codigo.includes(q) || nombre.includes(q) || cursoTxt.includes(q) || estadoTxt.includes(q);
      });
    }

    return data;
  });

  readonly stats = computed(() => {
    const rows = this.asistenciasFiltradas();
    const total = rows.length;
    const presentes = rows.filter((a) => (a?.estado ?? '').toString().toLowerCase() === 'presente').length;
    const ausentes = rows.filter((a) => (a?.estado ?? '').toString().toLowerCase() === 'ausente').length;
    return { total, presentes, ausentes };
  });

  constructor() {
    if (!this.isBrowser) return;

    this.cargarCursos();

    this.filtrosForm.controls.curso.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarAsistenciasRegistradas());

    this.filtrosForm.controls.fecha.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const normalized = value ? this.formatFecha(value) : '';
        if (normalized !== value) {
          this.filtrosForm.controls.fecha.setValue(normalized, { emitEvent: false });
        }
      });
  }

  setTab(tab: 'supervisar' | 'registrados') {
    this.activeTab.set(tab);
  }

  setBusqueda(value: string) {
    this.busquedaRegistradas.set(value);
  }

  setFiltroEstado(value: 'todos' | 'Presente' | 'Ausente') {
    this.filtroEstado.set(value);
  }

  limpiarFecha() {
    this.filtrosForm.controls.fecha.setValue('');
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }

  private getUsuarioFromStorage(): any | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private normalizarRol(raw: unknown): PerfilRol {
    if (typeof raw !== 'string') return 'desconocido';
    const v = raw.trim().toLowerCase();
    if (!v) return 'desconocido';
    if (v.includes('estudiante')) return 'estudiante';
    if (v.includes('docente') || v.includes('profesor')) return 'docente';
    if (v.includes('secretario')) return 'secretario';
    if (v === 'admin' || v.includes('administrador')) return 'admin';
    return 'desconocido';
  }

  private getRolActual(): PerfilRol {
    const u = this.getUsuarioFromStorage();
    if (!u) return 'desconocido';
    return this.normalizarRol(u?.rol ?? u?.role ?? u?.tipo ?? u?.tipo_usuario ?? u?.tipoUsuario ?? u?.perfil ?? u?.cargo);
  }

  private getDocenteIdActual(): number | null {
    const u = this.getUsuarioFromStorage();
    if (!u) return null;

    const raw = u?.docente_id ?? u?.docenteId ?? u?.id_docente ?? u?.idDocente ?? u?.docente?.id;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private resolveDocenteId$() {
    const direct = this.getDocenteIdActual();
    if (direct) return of(direct);

    const u = this.getUsuarioFromStorage();
    const correo = (u?.correo ?? u?.email ?? u?.usuario?.correo ?? u?.usuario?.email ?? '').toString().trim().toLowerCase();
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

  private normalizeCurso(input: any): CursoOption | null {
    const nested = input?.curso && typeof input.curso === 'object' ? input.curso : null;
    const src = nested ?? input;

    const id = Number(
      src?.id ?? src?.cursoId ?? src?.curso_id ?? src?.id_curso ?? input?.cursoId ?? input?.curso_id ?? input?.id_curso,
    );
    const nombre = (
      src?.nombre ??
      src?.nombreCurso ??
      src?.nombre_curso ??
      src?.curso_nombre ??
      src?.cursoNombre ??
      src?.name ??
      input?.nombre ??
      input?.nombreCurso ??
      input?.nombre_curso
    )?.toString?.().trim?.();
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;

    const codigo = (
      src?.codigo ?? src?.codigoCurso ?? src?.codigo_curso ?? input?.codigo ?? input?.codigoCurso ?? input?.codigo_curso
    )?.toString?.().trim?.();
    return { id, nombre, ...(codigo ? { codigo } : {}) };
  }

  formatFecha(value: unknown): string {
    if (value === null || value === undefined) return '';

    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    if (!text) return '';
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
    this.cargandoCursos.set(true);
    this.filtrosForm.controls.curso.disable({ emitEvent: false });

    const onOk = (data: any) => {
      const raw = Array.isArray(data) ? data : Array.isArray(data?.cursos) ? data.cursos : [];
      const normalized = raw
        .map((c: any) => this.normalizeCurso(c))
        .filter((c: CursoOption | null): c is CursoOption => !!c);
      this.cursosDisponibles.set(normalized);

			if (normalized.length) {
				this.filtrosForm.controls.curso.enable({ emitEvent: false });
			} else {
				this.filtrosForm.controls.curso.disable({ emitEvent: false });
			}
      this.cargandoCursos.set(false);
      this.cargarAsistenciasRegistradas();
    };

    const onErr = (err?: any) => {
      if (err) console.error('Error al cargar cursos', err);
      this.cursosDisponibles.set([]);
      this.filtrosForm.controls.curso.disable({ emitEvent: false });
      this.cargandoCursos.set(false);
    };

    const rol = this.getRolActual();
    if (rol === 'docente') {
      this.resolveDocenteId$()
        .pipe(
          take(1),
          switchMap((id) => {
            if (!id) return of([]);
            return this.docenteService.listarCursosAsignados(id).pipe(catchError(() => of([])));
          }),
        )
        .subscribe({ next: onOk, error: onErr });
      return;
    }

    this.cursoService.listar().pipe(take(1)).subscribe({ next: onOk, error: onErr });
  }

  cargarAsistenciasRegistradas() {
    const cursoValue = this.filtrosForm.controls.curso.value;
    const cursoId = cursoValue === 'todos' ? null : Number(cursoValue);

    if (cursoValue !== 'todos' && (!Number.isFinite(cursoId as any) || (cursoId as number) <= 0)) {
      this.asistencias.set([]);
      return;
    }

    if (cursoValue === 'todos' && !this.cursosDisponibles().length) {
      this.asistencias.set([]);
      return;
    }

    this.cargandoAsistencias.set(true);

    const toRows = (curso: CursoOption, res: any): AsistenciaRow[] => {
      const asistencias = Array.isArray(res?.asistencias) ? res.asistencias : [];
      return asistencias.map((a: any) => {
        const horaFin = a?.hora_fin ?? a?.horaFin ?? a?.hora_salida ?? a?.horaSalida ?? a?.hora_final ?? a?.horaFinal;
        return {
          ...a,
          hora_fin:
            typeof horaFin === 'string'
              ? horaFin
              : horaFin !== null && horaFin !== undefined
                ? String(horaFin)
                : undefined,
          curso: `${curso.codigo ? curso.codigo + ' - ' : ''}${curso.nombre}`,
          curso_id: curso.id,
        };
      });
    };

    if (cursoValue !== 'todos') {
      const curso =
        this.cursosDisponibles().find((c) => c.id === (cursoId as number)) ??
        ({ id: cursoId as number, nombre: '', codigo: '' } as CursoOption);
      this.asistenciaService
        .listarAsistenciasPorCurso(curso.id)
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            this.asistencias.set(toRows(curso, res));
            this.cargandoAsistencias.set(false);
          },
          error: () => {
            this.asistencias.set([]);
            this.cargandoAsistencias.set(false);
          },
        });
      return;
    }

    const requests = this.cursosDisponibles().map((c) =>
      this.asistenciaService.listarAsistenciasPorCurso(c.id).pipe(
        take(1),
        map((res) => toRows(c, res)),
        catchError(() => of([] as AsistenciaRow[])),
      ),
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (groups) => {
          const merged = (groups ?? []).reduce((acc: AsistenciaRow[], curr: AsistenciaRow[]) => acc.concat(curr), []);
          merged.sort((a, b) => {
            const ka = `${a?.fecha ?? ''} ${a?.hora_inicio ?? ''}`.trim();
            const kb = `${b?.fecha ?? ''} ${b?.hora_inicio ?? ''}`.trim();
            return kb.localeCompare(ka);
          });
          this.asistencias.set(merged);
          this.cargandoAsistencias.set(false);
        },
        error: () => {
          this.asistencias.set([]);
          this.cargandoAsistencias.set(false);
        },
      });
  }
}
