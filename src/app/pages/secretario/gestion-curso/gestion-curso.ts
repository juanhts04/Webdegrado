import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CursoService } from '../../../services/cursos';
import { HorarioService } from '../../../services/horarios';
import { ProgramasAcademicosService } from '../../../services/programas-academicos';

type TabKey = 'registro' | 'registrados';

type ProgramaAcademico = {
  id: number;
  nombre: string;
};

type Horario = {
  id: number;
  codigo?: string;
  dia?: string;
  dias?: string[];
  hora_inicio?: string;
  hora_fin?: string;
};

type CursoRow = {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  programaId?: number;
  programaNombre?: string;
  creditos?: number;
  semestre?: number;
  horarioIds: number[];
};

@Component({
  selector: 'app-gestion-curso',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestion-curso.html',
  styleUrl: './gestion-curso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionCurso {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly horarioService = inject(HorarioService);
  private readonly programasService = inject(ProgramasAcademicosService);

  readonly activeTab = signal<TabKey>('registro');

  readonly loading = signal<boolean>(false);
  readonly loadingAux = signal<boolean>(false);
  readonly query = signal<string>('');
  readonly editingId = signal<number | null>(null);

  readonly programasAcademicos = signal<ProgramaAcademico[]>([]);
  readonly horarios = signal<Horario[]>([]);
  readonly cursos = signal<CursoRow[]>([]);

  readonly filteredCursos = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.cursos();
    if (!q) return rows;
    return rows.filter((c) => {
      const codigo = c.codigo.toLowerCase();
      const nombre = c.nombre.toLowerCase();
      const programa = (c.programaNombre ?? '').toLowerCase();
      const descripcion = (c.descripcion ?? '').toLowerCase();
      const creditos = (c.creditos ?? '').toString().toLowerCase();
      return (
        codigo.includes(q) ||
        nombre.includes(q) ||
        programa.includes(q) ||
        descripcion.includes(q) ||
        creditos.includes(q)
      );
    });
  });

  readonly form = this.fb.nonNullable.group({
    codigo: this.fb.nonNullable.control('', [Validators.required]),
    nombre: this.fb.nonNullable.control('', [Validators.required]),
    descripcion: this.fb.nonNullable.control(''),
    programaId: this.fb.nonNullable.control('', [Validators.required]),
    creditos: this.fb.nonNullable.control('', [Validators.required]),
    semestre: this.fb.nonNullable.control(''),
    horarioIds: this.fb.nonNullable.control<string[]>([]),
  });

  constructor() {
    if (this.isBrowser) {
      this.loadAuxData();
      this.loadCursos();
    }

    this.cursoService.cursosChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.isBrowser) return;
        this.loadCursos();
      });
  }

  setTab(tab: TabKey) {
    this.activeTab.set(tab);
  }

  setQuery(value: string) {
    this.query.set(value);
  }

  private loadAuxData() {
    this.loadingAux.set(true);

    this.programasService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.programasAcademicos.set(
            list
              .map((p: any) => ({
                id: Number(p?.id),
                nombre: String(p?.nombre ?? '').trim(),
              }))
              .filter((p: ProgramaAcademico) => Number.isFinite(p.id) && p.id > 0 && !!p.nombre),
          );
        },
        error: () => {
          this.programasAcademicos.set([]);
        },
      });

    this.horarioService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.horarios.set(
            list
              .map((h: any) => ({
                id: Number(h?.id ?? h?.horario_id ?? h?.id_horario ?? h?.horarioId),
                codigo: typeof h?.codigo === 'string' ? h.codigo : undefined,
                dia: typeof h?.dia === 'string' ? h.dia : undefined,
                dias: Array.isArray(h?.dias) ? h.dias.map((x: any) => String(x)) : undefined,
                hora_inicio:
                  typeof h?.hora_inicio === 'string'
                    ? h.hora_inicio
                    : typeof h?.horaInicio === 'string'
                      ? h.horaInicio
                      : undefined,
                hora_fin:
                  typeof h?.hora_fin === 'string'
                    ? h.hora_fin
                    : typeof h?.horaFin === 'string'
                      ? h.horaFin
                      : undefined,
              }))
              .filter((h: Horario) => Number.isFinite(h.id) && h.id > 0),
          );
          this.loadingAux.set(false);
        },
        error: () => {
          this.horarios.set([]);
          this.loadingAux.set(false);
        },
      });
  }

  private parseHorarioIdsFrom(raw: any): number[] {
    const value =
      raw?.horario_ids ??
      raw?.horarioIds ??
      raw?.horarios_ids ??
      raw?.horariosIds ??
      raw?.horario_id ??
      raw?.horarioId;

    if (Array.isArray(value)) {
      return value.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(/[,;\s]+/g)
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x) && x > 0);
    }

    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? [n] : [];
  }

  private extractHorarioIdsFromList(list: any[]): number[] {
    return list
      .map((x: any) => {
        if (!x) return null;
        if (typeof x === 'object') {
          const id = Number(x?.id ?? x?.horario_id ?? x?.id_horario ?? x?.horarioId);
          return Number.isFinite(id) && id > 0 ? id : null;
        }
        const id = Number(x);
        return Number.isFinite(id) && id > 0 ? id : null;
      })
      .filter((x: number | null): x is number => x !== null);
  }

  private normalizeCurso(raw: any): CursoRow {
    const id = Number(raw?.id);
    const codigo = String(raw?.codigo ?? '').trim();
    const nombre = String(raw?.nombre ?? '').trim();
    const descripcion = String(raw?.descripcion ?? '').trim();
    const programaIdRaw = raw?.programa_id ?? raw?.programaId;
    const programaId = Number(programaIdRaw);
    const programaNombre = String(raw?.programa_nombre ?? raw?.programaNombre ?? '').trim();
    const creditosNum = Number(raw?.creditos);
    const semestreNum = Number(raw?.semestre);

    const horariosList = raw?.horarios ?? raw?.horarios_asignados ?? raw?.horariosAsignados;
    const horariosListIds = Array.isArray(horariosList) ? this.extractHorarioIdsFromList(horariosList) : [];
    const horarioSingleObj = raw?.horario && typeof raw.horario === 'object' ? raw.horario : null;
    const horarioSingleObjId = horarioSingleObj
      ? Number(horarioSingleObj?.id ?? horarioSingleObj?.horario_id ?? horarioSingleObj?.id_horario ?? horarioSingleObj?.horarioId)
      : NaN;

    const horarioIdsMerged = [
      ...horariosListIds,
      ...this.parseHorarioIdsFrom(raw),
      ...(Number.isFinite(horarioSingleObjId) && horarioSingleObjId > 0 ? [horarioSingleObjId] : []),
    ]
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    const programaNombreResolved = programaNombre || this.programasAcademicos().find((p) => p.id === programaId)?.nombre || '—';

    return {
      id: Number.isFinite(id) && id > 0 ? id : undefined,
      codigo,
      nombre,
      descripcion: descripcion || undefined,
      programaId: Number.isFinite(programaId) && programaId > 0 ? programaId : undefined,
      programaNombre: programaNombreResolved,
      creditos: Number.isFinite(creditosNum) ? creditosNum : undefined,
      semestre: Number.isFinite(semestreNum) ? semestreNum : undefined,
      horarioIds: Array.from(new Set(horarioIdsMerged)),
    };
  }

  private loadCursos() {
    this.loading.set(true);
    this.cursoService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.cursos.set(list.map((x: any) => this.normalizeCurso(x)));
          this.loading.set(false);
        },
        error: () => {
          this.cursos.set([]);
          this.loading.set(false);
        },
      });
  }

  isHorarioSelected(id: number): boolean {
    const key = String(id);
    return (this.form.controls.horarioIds.value ?? []).includes(key);
  }

  toggleHorario(id: number) {
    const key = String(id);
    const current = this.form.controls.horarioIds.value ?? [];
    const set = new Set(current);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    this.form.controls.horarioIds.setValue(Array.from(set));
  }

  removeHorario(id: number) {
    const key = String(id);
    const current = this.form.controls.horarioIds.value ?? [];
    if (!current.includes(key)) return;
    this.form.controls.horarioIds.setValue(current.filter((x) => x !== key));
  }

  selectedHorarios(): Horario[] {
    const selected = new Set(this.form.controls.horarioIds.value ?? []);
    if (!selected.size) return [];
    return this.horarios().filter((h) => selected.has(String(h.id)));
  }

  private formatHHmm(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const match = text.match(/\b([01]\d|2[0-3]):[0-5]\d/);
    return match?.[0] ?? '';
  }

  horarioLabel(h: Horario): string {
    const codigo = (h.codigo ?? '').toString().trim();
    const dia = (h.dia ?? '').toString().trim();
    const diasArr = Array.isArray(h.dias) ? h.dias : [];
    const dias = dia || (diasArr.length ? diasArr.join(', ') : '');
    const inicio = this.formatHHmm(h.hora_inicio);
    const fin = this.formatHHmm(h.hora_fin);

    const left = [codigo, dias].filter(Boolean).join(' · ');
    const right = [inicio, fin].filter(Boolean).join(' - ');
    return [left, right].filter(Boolean).join(' · ');
  }

  horarioPieces(h: Horario): { codigo: string; dias: string; hora: string } {
    const codigo = (h.codigo ?? '').toString().trim();
    const dia = (h.dia ?? '').toString().trim();
    const diasArr = Array.isArray(h.dias) ? h.dias : [];
    const dias = dia || (diasArr.length ? diasArr.join(', ') : '');
    const inicio = this.formatHHmm(h.hora_inicio);
    const fin = this.formatHHmm(h.hora_fin);
    const hora = [inicio, fin].filter(Boolean).join(' - ');
    return { codigo, dias, hora };
  }

  cursoHorariosText(curso: CursoRow): string {
    const ids = curso.horarioIds;
    if (!ids.length) return 'Sin horario';
    const labels = ids
      .map((id) => this.horarios().find((h) => h.id === id))
      .filter(Boolean)
      .map((h) => this.horarioLabel(h as Horario))
      .filter(Boolean);
    return labels.length ? labels.join(' | ') : `${ids.length} horario(s)`;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editingId = this.editingId();
    const value = this.form.getRawValue();
    const codigo = String(value.codigo ?? '').trim();
    const nombre = String(value.nombre ?? '').trim();
    const descripcion = String(value.descripcion ?? '').trim();
    const programaId = Number(value.programaId);
    const creditos = Number(value.creditos);
    const semestreRaw: unknown = value.semestre;
    const semestreText = typeof semestreRaw === 'number' ? String(semestreRaw) : String(semestreRaw ?? '').trim();
    const semestreParsed = semestreText ? Number(semestreText) : NaN;
    const semestre = Number.isFinite(semestreParsed) ? semestreParsed : undefined;
    const horarioIds = (value.horarioIds ?? [])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    const payload: any = {
      codigo,
      nombre,
      descripcion,
      programa_id: programaId,
      creditos,
    };

    if (semestre !== undefined && Number.isFinite(semestre)) {
      payload.semestre = semestre;
    }

    const uniqueHorarioIds = Array.from(new Set(horarioIds));
    if (uniqueHorarioIds.length === 1) {
      payload.horario_id = uniqueHorarioIds[0];
    } else if (uniqueHorarioIds.length > 1) {
      payload.horario_ids = uniqueHorarioIds;
    }

    if (editingId) {
      this.cursoService
        .actualizar(editingId, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.editingId.set(null);
            this.resetForm();
            this.loadCursos();
            this.activeTab.set('registrados');
          },
          error: (err) => {
            console.error('❌ Error al actualizar curso:', err);
            alert('No se pudo actualizar el curso. Revisa la consola para ver el error del API.');
          },
        });
      return;
    }

    this.cursoService
      .registrar(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resetForm();
          this.loadCursos();
          this.activeTab.set('registrados');
        },
        error: (err) => {
          console.error('❌ Error al registrar curso:', err);
          alert('No se pudo registrar el curso. Revisa la consola para ver el error del API.');
        },
      });
  }

  edit(row: CursoRow) {
    if (!row.id) return;
    this.editingId.set(row.id);
    this.activeTab.set('registro');
    this.form.setValue({
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion ?? '',
      programaId: row.programaId ? String(row.programaId) : '',
      creditos: row.creditos !== undefined ? String(row.creditos) : '',
      semestre: row.semestre !== undefined ? String(row.semestre) : '',
      horarioIds: (row.horarioIds ?? []).map(String),
    });
  }

  remove(row: CursoRow) {
    if (!row.id) return;
    const id = row.id;
    this.cursoService
      .eliminar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cursos.update((rows) => rows.filter((r) => r.id !== id));
          if (this.editingId() === id) this.cancel();
        },
      });
  }

  cancel() {
    this.editingId.set(null);
    this.resetForm();
    this.activeTab.set('registro');
  }

  private resetForm() {
    this.form.reset({
      codigo: '',
      nombre: '',
      descripcion: '',
      programaId: '',
      creditos: '',
      semestre: '',
      horarioIds: [],
    });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
