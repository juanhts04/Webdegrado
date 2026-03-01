import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CursoService } from '../../../services/cursos';
import { DocenteService } from '../../../services/docentes';
import { HorarioService } from '../../../services/horarios';
import { SalonService } from '../../../services/salon';

type HorarioRow = {
  id: number;
  codigo: string;
  dia?: string;
  hora_inicio?: string;
  hora_fin?: string;
  curso_id?: any;
  docente_id?: any;
  salon_id?: any;
  curso_nombre?: string;
  docente_nombre?: string;
  salon_nombre?: string;
};

@Component({
  selector: 'app-gestion-horario',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestion-horario.html',
  styleUrl: './gestion-horario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionHorario {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly horarioService = inject(HorarioService);
  private readonly cursoService = inject(CursoService);
  private readonly docenteService = inject(DocenteService);
  private readonly salonService = inject(SalonService);

  readonly activeTab = signal<'registro' | 'registrados'>('registro');
  readonly loading = signal<boolean>(false);
  readonly loadingCatalogos = signal<boolean>(false);
  readonly editingId = signal<number | null>(null);
  readonly busqueda = signal<string>('');

  readonly horarios = signal<HorarioRow[]>([]);

  readonly diasOptions = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ] as const;

  private horariosRaw: any[] = [];
  private cursosById = new Map<string, any>();
  private docentesById = new Map<string, any>();
  private salonesById = new Map<string, any>();
  private optionalIds: { curso_id?: any; docente_id?: any; salon_id?: any } = {};

  readonly form = this.fb.nonNullable.group({
    codigo: this.fb.nonNullable.control('', [Validators.required]),
    dias: this.fb.nonNullable.control<string[]>([], [Validators.required]),
    hora_inicio: this.fb.nonNullable.control('', [Validators.required]),
    hora_fin: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly filteredHorarios = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const rows = this.horarios();
    if (!q) return rows;
    return rows.filter((h) => {
      const curso = this.cursoDisplay(h).toLowerCase();
      const docente = this.docenteDisplay(h).toLowerCase();
      const salon = this.salonDisplay(h).toLowerCase();
      const dia = (h.dia ?? '').toString().toLowerCase();
      const codigo = (h.codigo ?? '').toString().toLowerCase();
      const inicio = (h.hora_inicio ?? '').toString().toLowerCase();
      const fin = (h.hora_fin ?? '').toString().toLowerCase();
      return (
        curso.includes(q) ||
        docente.includes(q) ||
        salon.includes(q) ||
        dia.includes(q) ||
        codigo.includes(q) ||
        inicio.includes(q) ||
        fin.includes(q)
      );
    });
  });

  constructor() {
    if (!this.isBrowser) return;
    this.loadHorarios();
    this.loadCatalogos();
  }

  setTab(tab: 'registro' | 'registrados') {
    this.activeTab.set(tab);
  }

  setBusqueda(value: string) {
    this.busqueda.set(value);
  }

  selectedDias(): string[] {
    return this.form.controls.dias.value;
  }

  isDiaSelected(dia: string): boolean {
    return this.form.controls.dias.value.includes(dia);
  }

  toggleDia(dia: string): void {
    const current = this.form.controls.dias.value;
    const isSelected = current.includes(dia);

    if (this.editingId()) {
      this.form.controls.dias.setValue(isSelected ? [] : [dia]);
      return;
    }

    this.form.controls.dias.setValue(
      isSelected ? current.filter((d) => d !== dia) : [...current, dia],
    );
  }

  removeDia(dia: string): void {
    const current = this.form.controls.dias.value;
    if (!current.includes(dia)) return;
    this.form.controls.dias.setValue(current.filter((d) => d !== dia));
  }

  private pickFirstDefined(obj: any, keys: string[]) {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== null && value !== undefined && value !== '') return value;
    }
    return undefined;
  }

  private buildMapById(list: any[], idKeys: string[]): Map<string, any> {
    const map = new Map<string, any>();
    for (const item of list) {
      const id = this.pickFirstDefined(item, idKeys);
      if (id !== null && id !== undefined && id !== '') {
        map.set(String(id), item);
      }
    }
    return map;
  }

  private nameFrom(obj: any, nameKeys: string[]): string {
    const value = this.pickFirstDefined(obj, nameKeys);
    return value !== null && value !== undefined ? String(value) : '';
  }

  cursoDisplay(h: any): string {
    const direct = this.pickFirstDefined(h, ['curso_nombre', 'cursoNombre', 'curso_name', 'cursoName']);
    if (direct) return String(direct);

    const cursoObj = h?.curso;
    if (typeof cursoObj === 'string') return cursoObj;
    if (cursoObj && typeof cursoObj === 'object') {
      const n = this.nameFrom(cursoObj, ['nombre', 'nombre_curso', 'curso_nombre', 'name']);
      if (n) return n;
    }

    const idCandidate = this.pickFirstDefined(h, ['curso_id', 'cursoId', 'id_curso', 'curso']);
    const id = idCandidate && typeof idCandidate === 'object' ? (idCandidate.id ?? idCandidate.curso_id ?? idCandidate.cursoId) : idCandidate;
    const curso = id !== null && id !== undefined ? this.cursosById.get(String(id)) : undefined;
    const name = this.nameFrom(curso, ['nombre', 'nombre_curso', 'curso_nombre', 'name']);
    return name || '—';
  }

  docenteDisplay(h: any): string {
    const direct = this.pickFirstDefined(h, ['docente_nombre', 'docenteNombre', 'docente_name', 'docenteName']);
    if (direct) return String(direct);

    const docenteObj = h?.docente;
    if (typeof docenteObj === 'string') return docenteObj;
    if (docenteObj && typeof docenteObj === 'object') {
      const n = this.nameFrom(docenteObj, ['nombre', 'docente_nombre', 'name']);
      if (n) return n;
    }

    const idCandidate = this.pickFirstDefined(h, ['docente_id', 'docenteId', 'id_docente', 'docente']);
    const id = idCandidate && typeof idCandidate === 'object' ? (idCandidate.id ?? idCandidate.docente_id ?? idCandidate.docenteId) : idCandidate;
    const docente = id !== null && id !== undefined ? this.docentesById.get(String(id)) : undefined;
    const name = this.nameFrom(docente, ['nombre', 'docente_nombre', 'name']);
    return name || '—';
  }

  salonDisplay(h: any): string {
    const direct = this.pickFirstDefined(h, ['salon_nombre', 'salonNombre', 'salon_name', 'salonName']);
    if (direct) return String(direct);

    const salonObj = h?.salon;
    if (typeof salonObj === 'string') return salonObj;
    if (salonObj && typeof salonObj === 'object') {
      const n = this.nameFrom(salonObj, ['nombre', 'salon_nombre', 'name']);
      if (n) return n;
      const composed = [salonObj?.bloque, salonObj?.numero_salon, salonObj?.numero].filter(Boolean).join(' - ');
      if (composed) return composed;
    }

    const idCandidate = this.pickFirstDefined(h, ['salon_id', 'salonId', 'id_salon', 'salon']);
    const id = idCandidate && typeof idCandidate === 'object' ? (idCandidate.id ?? idCandidate.salon_id ?? idCandidate.salonId) : idCandidate;
    const salon = id !== null && id !== undefined ? this.salonesById.get(String(id)) : undefined;
    const name = this.nameFrom(salon, ['nombre', 'salon_nombre', 'name']);
    if (name) return name;
    const composed = [salon?.bloque, salon?.numero_salon, salon?.numero].filter(Boolean).join(' - ');
    return composed || '—';
  }

  private rebuildHorarios() {
    const rows = (this.horariosRaw ?? []).map((h: any) => {
      const cursoNombre = this.cursoDisplay(h);
      const docenteNombre = this.docenteDisplay(h);
      const salonNombre = this.salonDisplay(h);
      return {
        ...h,
        id: Number(h?.id),
        codigo: String(h?.codigo ?? '').trim(),
        curso_nombre: h?.curso_nombre ?? (cursoNombre !== '—' ? cursoNombre : ''),
        docente_nombre: h?.docente_nombre ?? (docenteNombre !== '—' ? docenteNombre : ''),
        salon_nombre: h?.salon_nombre ?? (salonNombre !== '—' ? salonNombre : ''),
      } as HorarioRow;
    });
    this.horarios.set(rows.filter((r) => Number.isFinite(r.id) && r.id > 0));
  }

  private loadHorarios() {
    this.loading.set(true);
    this.horarioService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.horariosRaw = Array.isArray(res) ? res : [];
          this.rebuildHorarios();
          this.loading.set(false);
        },
        error: () => {
          this.horariosRaw = [];
          this.horarios.set([]);
          this.loading.set(false);
        },
      });
  }

  private loadCatalogos() {
    this.loadingCatalogos.set(true);

    this.cursoService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const cursos = Array.isArray(res) ? res : [];
          this.cursosById = this.buildMapById(cursos, ['id', 'curso_id', 'id_curso']);
          this.rebuildHorarios();
        },
      });

    this.docenteService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const docentes = Array.isArray(res) ? res : [];
          this.docentesById = this.buildMapById(docentes, ['id', 'docente_id', 'id_docente']);
          this.rebuildHorarios();
        },
      });

    this.salonService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const salones = Array.isArray(res) ? res : [];
          this.salonesById = this.buildMapById(salones, ['id', 'salon_id', 'id_salon']);
          this.rebuildHorarios();
          this.loadingCatalogos.set(false);
        },
        error: () => this.loadingCatalogos.set(false),
      });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const id = this.editingId();
    const withOptionalIds = (payload: any) => {
      const cursoId = this.optionalIds?.curso_id;
      const docenteId = this.optionalIds?.docente_id;
      const salonId = this.optionalIds?.salon_id;
      if (cursoId !== null && cursoId !== undefined && String(cursoId).trim() !== '') payload.curso_id = cursoId;
      if (docenteId !== null && docenteId !== undefined && String(docenteId).trim() !== '') payload.docente_id = docenteId;
      if (salonId !== null && salonId !== undefined && String(salonId).trim() !== '') payload.salon_id = salonId;
      return payload;
    };

    if (id) {
      const payload = withOptionalIds({
        dia: raw.dias?.[0],
        hora_inicio: raw.hora_inicio,
        hora_fin: raw.hora_fin,
      });
      this.horarioService
        .actualizar(id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.resetForm();
            this.loadHorarios();
            this.activeTab.set('registrados');
          },
        });
      return;
    }

    const payload = withOptionalIds({
      codigo: raw.codigo.trim(),
      dias: raw.dias,
      hora_inicio: raw.hora_inicio,
      hora_fin: raw.hora_fin,
    });
    this.horarioService
      .registrar(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resetForm();
          this.loadHorarios();
          this.activeTab.set('registrados');
        },
      });
  }

  edit(row: HorarioRow) {
    this.editingId.set(row.id);
    this.optionalIds = { curso_id: row.curso_id, docente_id: row.docente_id, salon_id: row.salon_id };
    this.form.controls.codigo.disable({ emitEvent: false });
    this.form.setValue({
      codigo: row.codigo ?? '',
      dias: [String(row.dia ?? '').trim()].filter(Boolean),
      hora_inicio: String(row.hora_inicio ?? ''),
      hora_fin: String(row.hora_fin ?? ''),
    });
    this.activeTab.set('registro');
  }

  remove(id: number) {
    this.horarioService
      .eliminar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadHorarios(),
      });
  }

  resetForm() {
    this.editingId.set(null);
    this.optionalIds = {};
    this.form.reset({ codigo: '', dias: [], hora_inicio: '', hora_fin: '' });
    this.form.controls.codigo.enable({ emitEvent: false });
    this.form.controls.codigo.setValidators([Validators.required]);
    this.form.controls.codigo.updateValueAndValidity({ emitEvent: false });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }

}
