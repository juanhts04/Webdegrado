import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CursoService } from '../../../services/cursos';
import { AsistenciaService } from '../../../services/asistencia';

import type { Chart as ChartJsChart } from 'chart.js';

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
  asistencia: number;
  ausencia: number;
  pAsistencia: string;
  pAusentismo: string;
};

type DonutItem = { programa: string; valor: number; color: string };

@Component({
  selector: 'app-sec-generar-reporte',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sec-generar-reporte.html',
  styleUrl: './sec-generar-reporte.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecGenerarReporte implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly asistenciaService = inject(AsistenciaService);

  @ViewChild('donutCanvas') donutCanvas?: ElementRef<HTMLCanvasElement>;
  private donutChart?: ChartJsChart;

  readonly cursos = signal<CursoOption[]>([]);
  readonly cargandoAsistenciasRegistradas = signal<boolean>(false);
  readonly asistenciasRegistradas = signal<AsistenciaRow[]>([]);
  readonly resultados = signal<ResultadoRow[]>([]);
  readonly ausentismoPorPrograma = signal<DonutItem[]>([]);

  readonly filtrosForm = this.fb.nonNullable.group({
    tipoReporte: this.fb.nonNullable.control(''),
    cursoId: this.fb.nonNullable.control(''),
    periodo: this.fb.nonNullable.control(''),
    corte: this.fb.nonNullable.control(''),
  });

  readonly canGenerate = computed(() => {
    const cursoId = Number(this.filtrosForm.controls.cursoId.value);
    return Number.isFinite(cursoId) && cursoId > 0;
  });

  constructor() {
    if (!this.isBrowser) return;

    this.cargarCursos();

    this.filtrosForm.controls.cursoId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cargarAsistenciasRegistradas();
      });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    queueMicrotask(() => this.renderDonut());
  }

  ngOnDestroy(): void {
    this.destroyDonut();
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

    const cursoId = Number(this.filtrosForm.controls.cursoId.value);
    if (!Number.isFinite(cursoId) || cursoId <= 0) {
      this.asistenciasRegistradas.set([]);
      return;
    }

    this.cargandoAsistenciasRegistradas.set(true);
    this.asistenciaService.listarAsistenciasPorCurso(cursoId).subscribe({
      next: (res) => {
        const rows: any[] = Array.isArray((res as any)?.asistencias) ? (res as any).asistencias : [];
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
        this.cargandoAsistenciasRegistradas.set(false);
      },
    });
  }

  generarReporte() {
    const asistencias = this.asistenciasRegistradas();
    if (!asistencias.length) {
      this.resultados.set([]);
      this.ausentismoPorPrograma.set([]);
      this.destroyDonut();
      return;
    }

    const agrupado = new Map<string, { total: number; asistencia: number; ausencia: number }>();

    for (const a of asistencias) {
      const curso = (a.curso ?? '—').toString().trim() || '—';
      if (!agrupado.has(curso)) {
        agrupado.set(curso, { total: 0, asistencia: 0, ausencia: 0 });
      }
      const bucket = agrupado.get(curso)!;
      bucket.total += 1;
      const estado = (a.estado ?? '').toString().trim().toLowerCase();
      if (estado === 'presente') bucket.asistencia += 1;
      if (estado === 'ausente') bucket.ausencia += 1;
    }

    const resultados: ResultadoRow[] = Array.from(agrupado.entries()).map(([curso, data]) => {
      const pAsistencia = data.total ? ((data.asistencia / data.total) * 100).toFixed(1) : '0.0';
      const pAusentismo = data.total ? ((data.ausencia / data.total) * 100).toFixed(1) : '0.0';
      return {
        curso,
        total: data.total,
        asistencia: data.asistencia,
        ausencia: data.ausencia,
        pAsistencia: `${pAsistencia}%`,
        pAusentismo: `${pAusentismo}%`,
      };
    });

    this.resultados.set(resultados);
    this.calcularDonutPorPrograma(asistencias);
  }

  private programaFromAsistencia(a: any): string {
    const direct = (a?.programa ?? a?.programa_nombre ?? a?.programaNombre ?? a?.programa_academico)?.toString?.().trim?.();
    if (direct) return direct;
    const estudiante = a?.estudiante;
    const nested = (estudiante?.programa ?? estudiante?.programa_nombre ?? estudiante?.programaNombre ?? estudiante?.programa_academico)?.toString?.().trim?.();
    return nested || '';
  }

  private calcularDonutPorPrograma(asistencias: AsistenciaRow[]) {
    const programas = new Map<string, { total: number; ausencias: number }>();

    for (const a of asistencias) {
      const programa = (a.programa ?? '').toString().trim();
      if (!programa) continue;
      if (!programas.has(programa)) {
        programas.set(programa, { total: 0, ausencias: 0 });
      }
      const bucket = programas.get(programa)!;
      bucket.total += 1;
      const estado = (a.estado ?? '').toString().trim().toLowerCase();
      if (estado === 'ausente') bucket.ausencias += 1;
    }

    const items: DonutItem[] = Array.from(programas.entries()).map(([programa, data]) => {
      const porcentaje = data.total ? ((data.ausencias / data.total) * 100).toFixed(1) : '0.0';
      return {
        programa,
        valor: Number(porcentaje),
        color: this.colorAleatorio(programa),
      };
    });

    this.ausentismoPorPrograma.set(items);
    this.renderDonut();
  }

  private colorAleatorio(seed: string): string {
    const colores = ['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', '#009688'];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return colores[hash % colores.length] ?? '#4CAF50';
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

  private destroyDonut() {
    try {
      this.donutChart?.destroy?.();
    } finally {
      this.donutChart = undefined;
    }
  }

  private async renderDonut() {
    if (!this.isBrowser) return;
    if (!this.donutCanvas?.nativeElement) return;

    const data = this.ausentismoPorPrograma();
    if (!data.length) {
      this.destroyDonut();
      return;
    }

    const ctx = this.donutCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.destroyDonut();

    const mod = await import('chart.js');
    const { Chart, DoughnutController, ArcElement, Tooltip, Legend } = mod;

    Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

    const labels = data.map((x) => x.programa);
    const values = data.map((x) => x.valor);
    const colors = data.map((x) => x.color);

    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  async exportarPDF() {
    if (!this.isBrowser) return;

    const resultados = this.resultados();
    if (!resultados.length) {
      alert('No hay datos para exportar');
      return;
    }

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default as unknown as (doc: any, opts: any) => void;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Reporte Ejecutivo de Asistencia', 14, 15);

    doc.setFontSize(10);
    doc.text(`Tipo: ${this.filtrosForm.controls.tipoReporte.value || 'General'}`, 14, 22);
    doc.text(`Periodo: ${this.filtrosForm.controls.periodo.value || 'Todos'}`, 14, 28);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 34);

    const body = resultados.map((r) => [r.curso, r.total, r.asistencia, r.ausencia, r.pAsistencia, r.pAusentismo]);

    autoTable(doc, {
      startY: 42,
      head: [["Curso", "Total", "Asistencia", "Ausencia", "% Asistencia", "% Ausentismo"]],
      body,
    });

    doc.save('reporte_ejecutivo.pdf');
  }
}
