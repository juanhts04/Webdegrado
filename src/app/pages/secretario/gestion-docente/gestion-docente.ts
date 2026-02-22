import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CursoService } from '../../../services/cursos';
import { DocenteService } from '../../../services/docentes';
import { ProgramasAcademicosService } from '../../../services/programas-academicos';

type ProgramaAcademico = { id: number; nombre: string };

type DocenteRow = {
  id: number;
  codigo: string;
  nombre: string;
  correo: string;
  programaAcademicoId: number | null;
  programaNombre?: string;
  descripcionPerfil?: string;
};

type CursoRow = {
  id: number;
  codigo?: string;
  nombre: string;
  programaNombre?: string;
  creditos?: number | null;
  descripcion?: string;
  asignacionId?: number;
};

@Component({
  selector: 'app-gestion-docente',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestion-docente.html',
  styleUrl: './gestion-docente.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionDocente {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly docenteService = inject(DocenteService);
  private readonly programasService = inject(ProgramasAcademicosService);
  private readonly cursoService = inject(CursoService);

  readonly activeTab = signal<'gestion' | 'registrados' | 'cursos'>('gestion');
  readonly loadingDocentes = signal<boolean>(false);
  readonly loadingCursos = signal<boolean>(false);
  readonly loadingCursosAsignados = signal<boolean>(false);

  readonly docenteEditandoId = signal<number | null>(null);
  readonly asignacionEditandoId = signal<number | null>(null);

  readonly programasAcademicos = signal<ProgramaAcademico[]>([]);
  readonly docentes = signal<DocenteRow[]>([]);
  readonly cursos = signal<CursoRow[]>([]);
  readonly cursosAsignados = signal<CursoRow[]>([]);

  readonly busquedaDocentes = signal<string>('');
  readonly docenteCursosId = signal<number | null>(null);
  readonly busquedaCursosAsignados = signal<string>('');

  readonly filteredDocentes = computed(() => {
    const q = this.busquedaDocentes().trim().toLowerCase();
    const rows = this.docentes();
    if (!q) return rows;
    return rows.filter((d) => {
      return (
        d.codigo.toLowerCase().includes(q) ||
        d.nombre.toLowerCase().includes(q) ||
        d.correo.toLowerCase().includes(q) ||
        (d.programaNombre ?? '').toLowerCase().includes(q) ||
        (d.descripcionPerfil ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly filteredCursosAsignados = computed(() => {
    const q = this.busquedaCursosAsignados().trim().toLowerCase();
    const rows = this.cursosAsignados();
    if (!q) return rows;
    return rows.filter((c) => {
      const codigo = (c.codigo ?? '').toLowerCase();
      const nombre = c.nombre.toLowerCase();
      const programa = (c.programaNombre ?? '').toLowerCase();
      const descripcion = (c.descripcion ?? '').toLowerCase();
      return codigo.includes(q) || nombre.includes(q) || programa.includes(q) || descripcion.includes(q);
    });
  });

  readonly docenteForm = this.fb.nonNullable.group({
    codigo: this.fb.nonNullable.control('', [Validators.required]),
    nombre: this.fb.nonNullable.control('', [Validators.required]),
    correo: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    password: this.fb.nonNullable.control('', [Validators.required]),
    programaAcademicoId: this.fb.nonNullable.control('', [Validators.required]),
    descripcionPerfil: this.fb.nonNullable.control(''),
  });

  readonly asignacionForm = this.fb.nonNullable.group({
    cursoId: this.fb.nonNullable.control('', [Validators.required]),
    docenteId: this.fb.nonNullable.control('', [Validators.required]),
  });

  constructor() {
    if (!this.isBrowser) return;
    this.loadProgramas();
    this.loadDocentes();
    this.loadCursos();
  }

  setTab(tab: 'gestion' | 'registrados' | 'cursos') {
    this.activeTab.set(tab);
  }

  setBusquedaDocentes(value: string) {
    this.busquedaDocentes.set(value);
  }

  setBusquedaCursosAsignados(value: string) {
    this.busquedaCursosAsignados.set(value);
  }

  private loadProgramas() {
    this.programasService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.programasAcademicos.set(
            list
              .map((p: any) => ({ id: Number(p?.id), nombre: String(p?.nombre ?? '').trim() }))
              .filter((p: ProgramaAcademico) => Number.isFinite(p.id) && p.id > 0 && !!p.nombre),
          );

          // Si los docentes ya se cargaron y no traen nombre de programa,
          // completar desde el catálogo recién cargado.
          const updated = this.docentes().map((d) => {
            const programaNombre = d.programaNombre && d.programaNombre !== '—' ? d.programaNombre : this.programaNombreById(d.programaAcademicoId);
            return { ...d, programaNombre };
          });
          this.docentes.set(updated);
        },
        error: () => this.programasAcademicos.set([]),
      });
  }

  private programaNombreById(id: number | null): string {
    if (!id) return '—';
    return this.programasAcademicos().find((p) => p.id === id)?.nombre ?? '—';
  }

  private normalizeDocente(raw: any): DocenteRow | null {
    const id = Number(raw?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const codigo = String(raw?.codigo ?? '').trim();
    const nombre = String(raw?.nombre ?? '').trim();
    const correo = String(raw?.correo ?? '').trim();
    const programaIdRaw = raw?.programa_academico ?? raw?.programa_id ?? raw?.programaAcademicoId;
    const programaAcademicoIdNum = Number(programaIdRaw);
    const programaAcademicoId = Number.isFinite(programaAcademicoIdNum) && programaAcademicoIdNum > 0 ? programaAcademicoIdNum : null;
    const descripcionPerfil = String(raw?.descripcion_perfil ?? raw?.descripcionPerfil ?? '').trim();
    const programaNombre = String(raw?.programa_nombre ?? raw?.programaNombre ?? '').trim() || this.programaNombreById(programaAcademicoId);

    return {
      id,
      codigo,
      nombre,
      correo,
      programaAcademicoId,
      programaNombre,
      descripcionPerfil: descripcionPerfil || undefined,
    };
  }

  private loadDocentes() {
    this.loadingDocentes.set(true);
    this.docenteService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.docentes.set(list.map((x: any) => this.normalizeDocente(x)).filter(Boolean) as DocenteRow[]);
          this.loadingDocentes.set(false);
        },
        error: () => {
          this.docentes.set([]);
          this.loadingDocentes.set(false);
        },
      });
  }

  private normalizeCurso(raw: any): CursoRow | null {
    const id = Number(raw?.id ?? raw?.cursoId ?? raw?.curso_id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const nombre = String(raw?.nombre ?? raw?.nombreCurso ?? raw?.curso_nombre ?? '').trim();
    const codigo = String(raw?.codigo ?? raw?.codigoCurso ?? raw?.curso_codigo ?? '').trim();
    const programaNombre = String(raw?.programa_nombre ?? raw?.programaNombre ?? '').trim();
    const creditosRaw = raw?.creditos;
    const creditosNum = creditosRaw === null || creditosRaw === undefined ? null : Number(creditosRaw);
    const descripcion = String(raw?.descripcion ?? '').trim();
    const asignacionIdNum = Number(raw?.asignacion_id ?? raw?.asignacionId);

    return {
      id,
      nombre: nombre || `Curso ${id}`,
      codigo: codigo || undefined,
      programaNombre: programaNombre || undefined,
      creditos: Number.isFinite(creditosNum as any) ? (creditosNum as number) : null,
      descripcion: descripcion || undefined,
      asignacionId: Number.isFinite(asignacionIdNum) && asignacionIdNum > 0 ? asignacionIdNum : undefined,
    };
  }

  private loadCursos() {
    this.loadingCursos.set(true);
    this.cursoService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.cursos.set(list.map((x: any) => this.normalizeCurso(x)).filter(Boolean) as CursoRow[]);
          this.loadingCursos.set(false);
        },
        error: () => {
          this.cursos.set([]);
          this.loadingCursos.set(false);
        },
      });
  }

  onDocenteCursosChange(value: string) {
    const id = Number(value);
    this.docenteCursosId.set(Number.isFinite(id) && id > 0 ? id : null);
    this.busquedaCursosAsignados.set('');
    this.loadCursosAsignados();
  }

  private loadCursosAsignados() {
    const docenteId = this.docenteCursosId();
    if (!docenteId) {
      this.cursosAsignados.set([]);
      return;
    }

    this.loadingCursosAsignados.set(true);
    this.docenteService
      .listarCursosAsignados(docenteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.cursosAsignados.set(list.map((x: any) => this.normalizeCurso(x)).filter(Boolean) as CursoRow[]);
          this.loadingCursosAsignados.set(false);
        },
        error: () => {
          this.cursosAsignados.set([]);
          this.loadingCursosAsignados.set(false);
        },
      });
  }

  submitDocente() {
    const editingId = this.docenteEditandoId();
    if (editingId) {
      this.docenteForm.controls.password.setValidators([]);
      this.docenteForm.controls.password.updateValueAndValidity({ emitEvent: false });
    } else {
      this.docenteForm.controls.password.setValidators([Validators.required]);
      this.docenteForm.controls.password.updateValueAndValidity({ emitEvent: false });
    }

    if (this.docenteForm.invalid) {
      this.docenteForm.markAllAsTouched();
      return;
    }

    const value = this.docenteForm.getRawValue();
    const payload: any = {
      codigo: value.codigo.trim(),
      nombre: value.nombre.trim(),
      correo: value.correo.trim(),
      programa_academico: Number(value.programaAcademicoId),
      descripcion_perfil: value.descripcionPerfil.trim(),
    };

    const password = value.password.trim();
    if (!editingId || password) {
      payload.password = password;
    }

    if (editingId) {
      this.docenteService
        .actualizar(editingId, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.cancelDocente();
            this.loadDocentes();
            this.activeTab.set('registrados');
          },
        });
      return;
    }

    this.docenteService
      .registrar(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelDocente();
          this.loadDocentes();
          this.activeTab.set('registrados');
        },
      });
  }

  editDocente(row: DocenteRow) {
    this.docenteEditandoId.set(row.id);
    this.docenteForm.setValue({
      codigo: row.codigo,
      nombre: row.nombre,
      correo: row.correo,
      password: '',
      programaAcademicoId: row.programaAcademicoId ? String(row.programaAcademicoId) : '',
      descripcionPerfil: row.descripcionPerfil ?? '',
    });
    this.activeTab.set('gestion');
  }

  removeDocente(id: number) {
    this.docenteService
      .eliminar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadDocentes(),
      });
  }

  cancelDocente() {
    this.docenteEditandoId.set(null);
    this.docenteForm.reset({
      codigo: '',
      nombre: '',
      correo: '',
      password: '',
      programaAcademicoId: '',
      descripcionPerfil: '',
    });
    this.docenteForm.controls.password.setValidators([Validators.required]);
    this.docenteForm.controls.password.updateValueAndValidity({ emitEvent: false });
  }

  submitAsignacion() {
    if (this.asignacionForm.invalid) {
      this.asignacionForm.markAllAsTouched();
      return;
    }

    const value = this.asignacionForm.getRawValue();
    const docenteId = Number(value.docenteId);
    const cursoId = Number(value.cursoId);
    const editingAsignacionId = this.asignacionEditandoId();

    if (editingAsignacionId) {
      this.docenteService
        .actualizarAsignacion(editingAsignacionId, { docenteId, cursoId })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.resetAsignacion(),
        });
      return;
    }

    this.docenteService
      .asignarCurso({ docenteId, cursoId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.resetAsignacion(),
      });
  }

  editCursoAsignado(row: CursoRow) {
    if (!row.asignacionId) return;
    const docenteId = this.docenteCursosId();
    if (!docenteId) return;
    this.asignacionEditandoId.set(row.asignacionId);
    this.asignacionForm.setValue({
      cursoId: String(row.id),
      docenteId: String(docenteId),
    });
    this.activeTab.set('gestion');
  }

  removeCursoAsignado(row: CursoRow) {
    if (!row.asignacionId) return;
    this.docenteService
      .eliminarAsignacion(row.asignacionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadCursosAsignados(),
      });
  }

  resetAsignacion() {
    this.asignacionEditandoId.set(null);
    this.asignacionForm.reset({ cursoId: '', docenteId: '' });
    this.loadCursosAsignados();
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
