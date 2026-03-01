import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AsistenciaService } from '../../../services/asistencia';
import { CursoService } from '../../../services/cursos';
import { DocenteService } from '../../../services/docentes';

type ReporteRow = {
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
  selector: 'app-generar-reporte',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './generar-reporte.html',
  styleUrl: './generar-reporte.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerarReporte {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly asistenciaService = inject(AsistenciaService);
  private readonly docenteService = inject(DocenteService);

  readonly cargandoCursos = signal<boolean>(false);
  readonly cargandoReporte = signal<boolean>(false);

  readonly cursos = signal<CursoOption[]>([]);
  readonly reporte = signal<ReporteRow[]>([]);
  readonly reporteFiltrado = signal<ReporteRow[]>([]);

  readonly toast = signal<string>('');

  readonly filtrosForm = this.fb.nonNullable.group({
    curso: this.fb.nonNullable.control('todos'),
    tipoReporte: this.fb.nonNullable.control(''),
  });

  constructor() {
    if (!this.isBrowser) return;

    this.cargarCursos();

    this.filtrosForm.controls.curso.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarReporte({ aplicarTipo: false }));
  }

  private showToast(message: string) {
    if (!this.isBrowser) return;
    this.toast.set(message);
    window.setTimeout(() => {
      if (this.toast() === message) this.toast.set('');
    }, 2400);
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
      src?.id ??
        src?.cursoId ??
        src?.curso_id ??
        src?.id_curso ??
        input?.cursoId ??
        input?.curso_id ??
        input?.id_curso,
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
    )
      ?.toString()
      .trim();
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;

    const codigo = (
      src?.codigo ??
      src?.codigoCurso ??
      src?.codigo_curso ??
      input?.codigo ??
      input?.codigoCurso ??
      input?.codigo_curso
    )
      ?.toString()
      .trim();

    return { id, nombre, ...(codigo ? { codigo } : {}) };
  }

  formatFecha(value: unknown): string {
    if (value === null || value === undefined) return '—';

    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

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

  isEstado(value: unknown, esperado: 'presente' | 'ausente') {
    return (value ?? '').toString().trim().toLowerCase() === esperado;
  }

  cargarCursos() {
    this.cargandoCursos.set(true);
    this.filtrosForm.controls.curso.disable({ emitEvent: false });

    const onOk = (data: any) => {
      const raw = Array.isArray(data) ? data : Array.isArray(data?.cursos) ? data.cursos : [];
      const normalized: CursoOption[] = raw
        .map((c: any) => this.normalizeCurso(c))
        .filter((c: CursoOption | null): c is CursoOption => !!c);

      this.cursos.set(normalized);

      const currentCurso = this.filtrosForm.controls.curso.value;
      if (currentCurso !== 'todos') {
        const id = Number(currentCurso);
        if (!Number.isFinite(id) || id <= 0 || !normalized.some((c: CursoOption) => c.id === id)) {
          this.filtrosForm.controls.curso.setValue('todos', { emitEvent: false });
        }
      }

      this.cargandoCursos.set(false);
      if (normalized.length) {
        this.filtrosForm.controls.curso.enable({ emitEvent: false });
      }
      this.cargarReporte({ aplicarTipo: false });
    };

    const onErr = (err?: unknown) => {
      console.error('Error al cargar cursos', err);
      this.cursos.set([]);
      this.reporte.set([]);
      this.reporteFiltrado.set([]);
      this.cargandoCursos.set(false);
      this.showToast('No se pudieron cargar los cursos');
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

  generarReporte() {
    this.cargarReporte({ aplicarTipo: true });
  }

  private aplicarFiltroTipo(base: ReporteRow[]): ReporteRow[] {
    const tipo = this.filtrosForm.controls.tipoReporte.value.toString().trim();
    if (!tipo) return [...base];

    const hoy = new Date();

    return base.filter((row) => {
      if (!row?.fecha) return false;
      const fechaAsistencia = new Date(row.fecha);
      if (!Number.isFinite(fechaAsistencia.getTime())) return false;

      if (tipo === 'Asistencia Diaria') {
        return fechaAsistencia.toDateString() === hoy.toDateString();
      }

      if (tipo === 'Asistencia Semanal') {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - 7);
        return fechaAsistencia >= inicioSemana;
      }

      if (tipo === 'Asistencia Mensual') {
        return fechaAsistencia.getMonth() === hoy.getMonth() && fechaAsistencia.getFullYear() === hoy.getFullYear();
      }

      return true;
    });
  }

  private cargarReporte(opts: { aplicarTipo: boolean }) {
    if (!this.isBrowser) return;

    const cursoRaw = this.filtrosForm.controls.curso.value;
    const cursoId = cursoRaw === 'todos' ? null : Number(cursoRaw);

    if (cursoRaw !== 'todos' && (!Number.isFinite(cursoId) || (cursoId ?? 0) <= 0)) {
      this.reporte.set([]);
      this.reporteFiltrado.set([]);
      return;
    }

    const cursos = this.cursos();
    if (cursoRaw === 'todos' && !cursos.length) {
      this.reporte.set([]);
      this.reporteFiltrado.set([]);
      return;
    }

    this.cargandoReporte.set(true);

    const toRows = (curso: CursoOption, res: any): ReporteRow[] => {
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

    const onDone = (rows: ReporteRow[]) => {
      const sorted = [...rows].sort((a, b) => {
        const ka = `${a?.fecha ?? ''} ${a?.hora_inicio ?? ''}`.trim();
        const kb = `${b?.fecha ?? ''} ${b?.hora_inicio ?? ''}`.trim();
        return kb.localeCompare(ka);
      });

      this.reporte.set(sorted);
      this.reporteFiltrado.set(opts.aplicarTipo ? this.aplicarFiltroTipo(sorted) : [...sorted]);
      this.cargandoReporte.set(false);
    };

    const onErr = (err?: unknown) => {
      console.error('Error al cargar reporte', err);
      this.reporte.set([]);
      this.reporteFiltrado.set([]);
      this.cargandoReporte.set(false);
      this.showToast('No se pudo cargar el reporte');
    };

    if (cursoRaw !== 'todos') {
      const curso = cursos.find((c) => c.id === cursoId) ?? { id: cursoId as number, nombre: '', codigo: '' };
      this.asistenciaService
        .listarAsistenciasPorCurso(curso.id)
        .pipe(take(1))
        .subscribe({
          next: (res) => onDone(toRows(curso, res)),
          error: onErr,
        });
      return;
    }

    const requests = cursos.map((c) =>
      this.asistenciaService.listarAsistenciasPorCurso(c.id).pipe(
        take(1),
        map((res) => toRows(c, res)),
        catchError(() => of([] as ReporteRow[])),
      ),
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (groups) => {
          const merged = (groups ?? []).reduce((acc: ReporteRow[], curr: ReporteRow[]) => acc.concat(curr), []);
          onDone(merged);
        },
        error: onErr,
      });
  }

  async exportarPDF() {
    if (!this.isBrowser) return;

    const data = this.reporteFiltrado();
    if (!data.length) {
      alert('No hay datos para exportar');
      return;
    }

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default as unknown as (doc: any, opts: any) => void;

    const doc = new jsPDF();

    const titulo = 'Reporte de Asistencia';
    const fechaGeneracion = new Date().toLocaleString();

    const cursoRaw = this.filtrosForm.controls.curso.value;
    const cursoLabel =
      cursoRaw === 'todos'
        ? 'Todos'
        : (() => {
            const id = Number(cursoRaw);
            const match = this.cursos().find((c) => c.id === id);
            if (match) return `${match.codigo ? match.codigo + ' - ' : ''}${match.nombre}`;
            return String(cursoRaw);
          })();

    doc.setFontSize(16);
    doc.text(titulo, 14, 15);

    doc.setFontSize(10);
    doc.text(`Curso: ${cursoLabel}`, 14, 22);
    doc.text(`Tipo: ${this.filtrosForm.controls.tipoReporte.value || 'General'}`, 14, 28);
    doc.text(`Generado: ${fechaGeneracion}`, 14, 34);

    const body = data.map((row) => [
      row.id_asistencia ?? '',
      row.nombre_completo ?? '',
      row.curso ?? '',
      this.formatFecha(row.fecha),
      row.hora_inicio ?? '',
      row.hora_fin ?? '—',
      row.estado ?? '',
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['ID', 'Nombre', 'Curso', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Estado']],
      body,
    });

    doc.save('reporte_asistencia.pdf');
  }
}
