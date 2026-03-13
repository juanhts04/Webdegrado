import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CursoService } from '../../../services/cursos';
import { AsistenciaService } from '../../../services/asistencia';

type CursoOption = { id: number; nombre: string; codigo?: string };

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
  programa?: string;
};

type ResultadoRow = {
  curso: string;
  total: number;
  asistenciaCompletada: number;
  ausentismo: number;
  pAsistenciaCompletada: string;
  pAusentismo: string;

	// Compatibilidad con template anterior (columnas Asistencia/Ausencia)
	asistencia?: number;
	ausencia?: number;
	pAsistencia?: string;
};

@Component({
  selector: 'app-sec-generar-reporte',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sec-generar-reporte.html',
  styleUrl: './sec-generar-reporte.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecGenerarReporte {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly asistenciaService = inject(AsistenciaService);

  readonly cursos = signal<CursoOption[]>([]);
  readonly cargandoAsistenciasRegistradas = signal<boolean>(false);
  readonly asistenciasRegistradas = signal<AsistenciaRow[]>([]);
	readonly totalEstudiantesCurso = signal<number>(0);
  readonly resultados = signal<ResultadoRow[]>([]);
	readonly reporteErrorMessage = signal<string>('');
	readonly exportErrorMessage = signal<string>('');

  readonly filtrosForm = this.fb.nonNullable.group({
    tipoReporte: this.fb.nonNullable.control(''),
    cursoId: this.fb.nonNullable.control(''),
    periodo: this.fb.nonNullable.control(''),
    corte: this.fb.nonNullable.control(''),
  });

	// ReactiveForms no notifica a signals por sí solo.
	// Sincronizamos el curso seleccionado a un signal para que `canGenerate` reaccione.
	readonly selectedCursoId = signal<string>(this.filtrosForm.controls.cursoId.value);

  readonly canGenerate = computed(() => {
    const cursoId = Number(this.selectedCursoId());
    return Number.isFinite(cursoId) && cursoId > 0;
  });

  constructor() {
    if (!this.isBrowser) return;

    this.cargarCursos();

    this.filtrosForm.controls.cursoId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((value) => {
				this.selectedCursoId.set(value);
        this.cargarAsistenciasRegistradas();
      });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }

  cargarCursos() {
    this.cursoService.listar().subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : [];
        const normalized: CursoOption[] = list
          .map((c: any) => {
            const id = Number(c?.id ?? c?.curso_id ?? c?.id_curso);
            const nombre = (c?.nombre ?? c?.nombre_curso ?? '').toString().trim();
            const codigo = (c?.codigo ?? c?.codigo_curso ?? '').toString().trim();
            if (!Number.isFinite(id) || id <= 0 || !nombre) return null;
            return { id, nombre, ...(codigo ? { codigo } : {}) };
          })
          .filter((x: CursoOption | null): x is CursoOption => !!x);

        this.cursos.set(normalized);

        if (this.canGenerate()) {
          this.cargarAsistenciasRegistradas();
        }
      },
      error: (err) => {
        console.error('Error al cargar cursos', err);
        this.cursos.set([]);
      },
    });
  }

  private cursoSeleccionadoLabel(): string {
    const id = Number(this.filtrosForm.controls.cursoId.value);
    if (!Number.isFinite(id) || id <= 0) return '';
    const match = this.cursos().find((c) => c.id === id);
    if (!match) return '';
    return `${match.codigo ? match.codigo + ' - ' : ''}${match.nombre}`;
  }

  cargarAsistenciasRegistradas() {
    if (!this.isBrowser) return;
		this.reporteErrorMessage.set('');

    const cursoId = Number(this.filtrosForm.controls.cursoId.value);
    if (!Number.isFinite(cursoId) || cursoId <= 0) {
      this.asistenciasRegistradas.set([]);
			this.totalEstudiantesCurso.set(0);
      return;
    }

    this.cargandoAsistenciasRegistradas.set(true);
    this.asistenciaService.listarAsistenciasPorCurso(cursoId).subscribe({
      next: (res) => {
        const maybeAny = res as any;
      const totalRaw = Number(maybeAny?.total ?? maybeAny?.total_estudiantes ?? maybeAny?.totalEstudiantes);
      this.totalEstudiantesCurso.set(Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : 0);
			const rows: any[] = Array.isArray(maybeAny?.asistencias)
				? maybeAny.asistencias
				: Array.isArray(maybeAny)
					? maybeAny
					: Array.isArray(maybeAny?.data)
						? maybeAny.data
						: [];
        const curso = this.cursoSeleccionadoLabel();
        const mapped: AsistenciaRow[] = rows.map((a: any) => ({
          ...a,
          curso,
          curso_id: cursoId,
          programa: this.programaFromAsistencia(a),
        }));
        this.asistenciasRegistradas.set(mapped);
        this.cargandoAsistenciasRegistradas.set(false);
      },
      error: (err) => {
        console.error('Error al cargar asistencias registradas', err);
        this.asistenciasRegistradas.set([]);
      this.totalEstudiantesCurso.set(0);
			this.reporteErrorMessage.set('No se pudieron cargar asistencias para el curso seleccionado.');
        this.cargandoAsistenciasRegistradas.set(false);
      },
    });
  }

  private estadoCategoria(estado: unknown): 'completada' | 'ausentismo' | 'otro' {
    const raw = (estado ?? '').toString().trim().toLowerCase();
    if (!raw) return 'otro';

    // Ausentismo / ausente
    if (raw === 'ausente' || raw === 'ausencia' || raw.includes('ausent')) return 'ausentismo';

    // Asistencia completada / presente
    if (raw === 'presente') return 'completada';
    if (raw.includes('complet')) return 'completada';
    if (raw.includes('asistencia complet')) return 'completada';
    if (raw.includes('asistencia completa')) return 'completada';

    return 'otro';
  }

  private totalEstudiantesFromRows(rows: AsistenciaRow[]): number {
    const totalBackend = this.totalEstudiantesCurso();
    if (Number.isFinite(totalBackend) && totalBackend > 0) return totalBackend;

    const ids = new Set<string>();
    for (const r of rows) {
      const estudianteId = r.estudiante_id;
      if (Number.isFinite(estudianteId) && (estudianteId ?? 0) > 0) {
        ids.add(`id:${estudianteId}`);
        continue;
      }
      const codigo = (r.codigo ?? '').toString().trim();
      if (codigo) {
        ids.add(`cod:${codigo}`);
        continue;
      }
      const nombre = (r.nombre_completo ?? '').toString().trim();
      if (nombre) ids.add(`nom:${nombre}`);
    }
    return ids.size || rows.length;
  }

  generarReporte() {
		this.reporteErrorMessage.set('');
		this.exportErrorMessage.set('');

		if (!this.canGenerate()) {
			this.reporteErrorMessage.set('Selecciona un curso para generar el reporte.');
			return;
		}

		if (this.cargandoAsistenciasRegistradas()) {
			this.reporteErrorMessage.set('Espera a que terminen de cargar las asistencias.');
			return;
		}

    const asistencias = this.asistenciasRegistradas();
    if (!asistencias.length) {
      this.resultados.set([]);
			this.reporteErrorMessage.set('No hay asistencias registradas para el curso seleccionado.');
      return;
    }

		// Reporte actual: se genera para un curso seleccionado.
		const curso = (asistencias[0]?.curso ?? this.cursoSeleccionadoLabel() ?? '—').toString().trim() || '—';
		const totalEstudiantes = this.totalEstudiantesFromRows(asistencias);
		let completadas = 0;
		let ausentismo = 0;

		for (const a of asistencias) {
			const cat = this.estadoCategoria(a.estado);
			if (cat === 'completada') completadas += 1;
			if (cat === 'ausentismo') ausentismo += 1;
		}

		const pAsistenciaCompletada = totalEstudiantes ? ((completadas / totalEstudiantes) * 100).toFixed(1) : '0.0';
		const pAusentismo = totalEstudiantes ? ((ausentismo / totalEstudiantes) * 100).toFixed(1) : '0.0';

		const resultados: ResultadoRow[] = [
			{
				curso,
				total: totalEstudiantes,
				asistenciaCompletada: completadas,
				ausentismo,
				pAsistenciaCompletada: `${pAsistenciaCompletada}%`,
				pAusentismo: `${pAusentismo}%`,

        // Compatibilidad
        asistencia: completadas,
        ausencia: ausentismo,
        pAsistencia: `${pAsistenciaCompletada}%`,
			},
		];

    this.resultados.set(resultados);
  }

  private programaFromAsistencia(a: any): string {
    const direct = (a?.programa ?? a?.programa_nombre ?? a?.programaNombre ?? a?.programa_academico)?.toString?.().trim?.();
    if (direct) return direct;
    const estudiante = a?.estudiante;
    const nested = (estudiante?.programa ?? estudiante?.programa_nombre ?? estudiante?.programaNombre ?? estudiante?.programa_academico)?.toString?.().trim?.();
    return nested || '';
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

  async exportarPDF() {
    if (!this.isBrowser) return;
    this.exportErrorMessage.set('');

    const resultados = this.resultados();
    if (!resultados.length) {
      this.exportErrorMessage.set('Primero genera el reporte para poder exportar.');
      alert('No hay datos para exportar');
      return;
    }

    try {
      const jspdfMod: any = await import('jspdf');
      const jsPDFCtor = jspdfMod?.jsPDF ?? jspdfMod?.default;
      if (!jsPDFCtor) throw new Error('No se pudo resolver jsPDF desde el paquete jspdf.');

      const autoTableMod: any = await import('jspdf-autotable');
      const autoTable = (autoTableMod?.default ?? autoTableMod) as (doc: any, opts: any) => void;
      if (typeof autoTable !== 'function') throw new Error('No se pudo resolver autoTable desde jspdf-autotable.');

      const doc = new jsPDFCtor();

      doc.setFontSize(16);
      doc.text('Reporte Ejecutivo de Asistencia', 14, 15);

      doc.setFontSize(10);
      doc.text(`Tipo: ${this.filtrosForm.controls.tipoReporte.value || 'General'}`, 14, 22);
      doc.text(`Periodo: ${this.filtrosForm.controls.periodo.value || 'Todos'}`, 14, 28);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 34);

      const body = resultados.map((r) => [
        r.curso,
        r.total,
        r.asistenciaCompletada,
        r.ausentismo,
        r.pAsistenciaCompletada,
        r.pAusentismo,
      ]);

      autoTable(doc, {
        startY: 42,
        head: [["Curso", "Total estudiantes", "Asistencia completada", "Ausentismo", "% Asistencia", "% Ausentismo"]],
        body,
      });

      doc.save('reporte_ejecutivo.pdf');
    } catch (err) {
      console.error('Error exportando PDF', err);
      this.exportErrorMessage.set('No se pudo exportar el PDF. Revisa la consola para más detalle.');
      alert('No se pudo exportar el PDF');
    }
  }
}
