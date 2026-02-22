import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CursoService } from '../../../services/cursos';
import { SalonService } from '../../../services/salon';

type TabKey = 'registro' | 'registrados' | 'salones';

type SalonRow = {
  id?: number;
  codigo: string;
  nombre: string;
  bloque: string;
  numero_salon: number | null;
};

type CursoRow = {
  id: number;
  codigo?: string;
  nombre: string;
};

type AsignacionRow = {
  asignacionId: number | null;
  cursoId: number;
  cursoNombre: string;
  cursoCodigo: string;
  salonId: number;
  salonNombre: string;
  salonCodigo: string;
  salonBloque: string;
  salonNumero: number | null;
};

@Component({
  selector: 'app-gestion-salon',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './gestion-salon.html',
  styleUrl: './gestion-salon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionSalon {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly salonService = inject(SalonService);
  private readonly cursoService = inject(CursoService);

  readonly activeTab = signal<TabKey>('registro');
  readonly editingId = signal<number | null>(null);

  readonly loadingSalones = signal<boolean>(false);
  readonly loadingCursos = signal<boolean>(false);
  readonly loadingAsignaciones = signal<boolean>(false);

  readonly busquedaSalones = signal<string>('');
  readonly salonAsignadoFiltroId = signal<number | null>(null);
  readonly busquedaSalonesAsignados = signal<string>('');

  readonly salonesRegistrados = signal<SalonRow[]>([]);
  readonly cursos = signal<CursoRow[]>([]);
  readonly salonesAsignados = signal<AsignacionRow[]>([]);
  readonly salonesAsignadosUnicos = signal<Array<{ id: number; codigo?: string; nombre: string; bloque?: string; numero_salon?: number | null }>>([]);

  private asignacionesRaw: any[] = [];

  readonly salonForm = this.fb.nonNullable.group({
    codigo: this.fb.nonNullable.control('', [Validators.required]),
    nombre: this.fb.nonNullable.control('', [Validators.required]),
    bloque: this.fb.nonNullable.control('', [Validators.required]),
    numero_salon: this.fb.nonNullable.control('', [Validators.required]),
  });

  readonly asignacionForm = this.fb.nonNullable.group({
    cursoId: this.fb.nonNullable.control({ value: '', disabled: true }, [Validators.required]),
    salonId: this.fb.nonNullable.control({ value: '', disabled: true }, [Validators.required]),
  });

  readonly salonesFiltrados = computed(() => {
    const q = this.busquedaSalones().trim().toLowerCase();
    const rows = this.salonesRegistrados();
    if (!q) return rows;
    return rows.filter((s) => {
      return (
        s.codigo.toLowerCase().includes(q) ||
        s.nombre.toLowerCase().includes(q) ||
        s.bloque.toLowerCase().includes(q) ||
        String(s.numero_salon ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly salonesAsignadosFiltrados = computed(() => {
    let base = [...this.salonesAsignados()];
    const salonId = this.salonAsignadoFiltroId();
    if (salonId) {
      base = base.filter((r) => r.salonId === salonId);
    }

    const q = this.busquedaSalonesAsignados().trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      const cursoNombre = (r.cursoNombre ?? '').toLowerCase();
      const cursoCodigo = (r.cursoCodigo ?? '').toLowerCase();
      const salonNombre = (r.salonNombre ?? '').toLowerCase();
      const salonCodigo = (r.salonCodigo ?? '').toLowerCase();
      const salonBloque = (r.salonBloque ?? '').toLowerCase();
      const salonNumero = String(r.salonNumero ?? '').toLowerCase();
      return (
        cursoNombre.includes(q) ||
        cursoCodigo.includes(q) ||
        salonNombre.includes(q) ||
        salonCodigo.includes(q) ||
        salonBloque.includes(q) ||
        salonNumero.includes(q)
      );
    });
  });

  constructor() {
    if (!this.isBrowser) return;
    this.loadSalones();
    this.loadCursos();
    this.loadAsignaciones();
  }

  setTab(tab: TabKey) {
    this.activeTab.set(tab);
  }

  setBusquedaSalones(value: string) {
    this.busquedaSalones.set(value);
  }

  setBusquedaSalonesAsignados(value: string) {
    this.busquedaSalonesAsignados.set(value);
  }

  onSalonAsignadoFiltroChange(value: string) {
    const id = Number(value);
    this.salonAsignadoFiltroId.set(Number.isFinite(id) && id > 0 ? id : null);
  }

  private pickFirstDefined(obj: any, keys: string[]) {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== null && value !== undefined && value !== '') return value;
    }
    return undefined;
  }

  private extractArray(res: any): any[] {
    if (Array.isArray(res)) return res;
    const candidates = [
      res?.data,
      res?.rows,
      res?.result,
      res?.asignaciones,
      res?.asignacionesSalonCurso,
      res?.salonCurso,
      res?.salon_curso,
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
    return [];
  }

  private normalizeSalon(raw: any): SalonRow | null {
    const id = Number(this.pickFirstDefined(raw, ['id', 'salon_id', 'id_salon', 'salonId']));
    const codigo = String(raw?.codigo ?? '').trim();
    const nombre = String(raw?.nombre ?? raw?.salon_nombre ?? '').trim();
    const bloque = String(raw?.bloque ?? '').trim();
    const numeroRaw = raw?.numero_salon ?? raw?.numero ?? null;
    const numero_salon =
      numeroRaw === null || numeroRaw === undefined || String(numeroRaw).trim() === ''
        ? null
        : Number.isFinite(Number(numeroRaw))
          ? Number(numeroRaw)
          : null;

    if (!codigo || !nombre) return null;
    return {
      id: Number.isFinite(id) && id > 0 ? id : undefined,
      codigo,
      nombre,
      bloque,
      numero_salon,
    };
  }

  private normalizeCurso(raw: any): CursoRow | null {
    const id = Number(this.pickFirstDefined(raw, ['id', 'curso_id', 'id_curso', 'cursoId']));
    if (!Number.isFinite(id) || id <= 0) return null;
    const nombre = String(raw?.nombre ?? raw?.nombreCurso ?? raw?.name ?? '').trim() || `Curso ${id}`;
    const codigo = String(raw?.codigo ?? raw?.codigo_curso ?? raw?.codigoCurso ?? '').trim();
    return { id, nombre, codigo: codigo || undefined };
  }

  private loadSalones() {
    this.loadingSalones.set(true);
    this.salonService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.salonesRegistrados.set(list.map((x: any) => this.normalizeSalon(x)).filter(Boolean) as SalonRow[]);
          this.loadingSalones.set(false);
          this.updateAsignacionAvailability();
          this.rebuildAsignaciones();
        },
        error: () => {
          this.salonesRegistrados.set([]);
          this.loadingSalones.set(false);
          this.updateAsignacionAvailability();
          this.rebuildAsignaciones();
        },
      });
  }

  private loadCursos() {
    this.loadingCursos.set(true);
    this.cursoService
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : Array.isArray((data as any)?.cursos) ? (data as any).cursos : [];
          this.cursos.set(list.map((x: any) => this.normalizeCurso(x)).filter(Boolean) as CursoRow[]);
          this.loadingCursos.set(false);
          this.updateAsignacionAvailability();
          this.rebuildAsignaciones();
        },
        error: () => {
          this.cursos.set([]);
          this.loadingCursos.set(false);
          this.updateAsignacionAvailability();
          this.rebuildAsignaciones();
        },
      });
  }

  private updateAsignacionAvailability() {
    const cursoCtrl = this.asignacionForm.controls.cursoId;
    if (this.cursos().length === 0) {
      cursoCtrl.disable({ emitEvent: false });
    } else {
      cursoCtrl.enable({ emitEvent: false });
    }

    const salonCtrl = this.asignacionForm.controls.salonId;
    if (this.salonesRegistrados().length === 0) {
      salonCtrl.disable({ emitEvent: false });
    } else {
      salonCtrl.enable({ emitEvent: false });
    }
  }

  private loadAsignaciones() {
    this.loadingAsignaciones.set(true);
    this.salonService
      .listarSalonCurso()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.asignacionesRaw = this.extractArray(res);
          this.loadingAsignaciones.set(false);
          this.rebuildAsignaciones();
        },
        error: () => {
          this.asignacionesRaw = [];
          this.loadingAsignaciones.set(false);
          this.rebuildAsignaciones();
        },
      });
  }

  private buildUniqueSalonesFromAsignados(rows: AsignacionRow[]) {
    const uniqueMap = new Map<number, { id: number; codigo?: string; nombre: string; bloque?: string; numero_salon?: number | null }>();
    for (const r of rows ?? []) {
      const id = Number(r?.salonId);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, {
          id,
          codigo: r?.salonCodigo || undefined,
          nombre: r?.salonNombre || `Salón ${id}`,
          bloque: r?.salonBloque || undefined,
          numero_salon: r?.salonNumero ?? null,
        });
      }
    }

    const unique = Array.from(uniqueMap.values()).sort((a, b) => `${a.nombre}`.localeCompare(`${b.nombre}`));
    this.salonesAsignadosUnicos.set(unique);

    const selected = this.salonAsignadoFiltroId();
    if (selected && !uniqueMap.has(selected)) {
      this.salonAsignadoFiltroId.set(null);
    }
  }

  private rebuildAsignacionesFromCursosFallback(): AsignacionRow[] {
    const cursosRaw = this.cursos();
    const salones = this.salonesRegistrados();
    const salonesById = new Map<number, SalonRow>();
    for (const s of salones) {
      if (s.id) salonesById.set(s.id, s);
    }

    const rows: AsignacionRow[] = [];
    for (const c of cursosRaw) {
      // En este workspace, /cursos no está tipado con salon_id, pero mantenemos el fallback minimal.
      // Si el backend lo expone, se podrá reconstruir aquí.
      const anyCurso: any = c as any;
      const cursoId = Number(anyCurso?.id ?? anyCurso?.curso_id ?? anyCurso?.id_curso ?? anyCurso?.cursoId);
      const salonId = Number(anyCurso?.salon_id ?? anyCurso?.id_salon ?? anyCurso?.salonId ?? anyCurso?.salon?.id ?? anyCurso?.salon);
      if (!Number.isFinite(cursoId) || cursoId <= 0) continue;
      if (!Number.isFinite(salonId) || salonId <= 0) continue;

      const salon = salonesById.get(salonId) ?? (anyCurso?.salon && typeof anyCurso.salon === 'object' ? anyCurso.salon : null);
      rows.push({
        asignacionId: null,
        cursoId,
        cursoNombre: c.nombre,
        cursoCodigo: c.codigo ?? '',
        salonId,
        salonNombre: String(salon?.nombre ?? anyCurso?.salon_nombre ?? '') || `Salón ${salonId}`,
        salonCodigo: String(salon?.codigo ?? anyCurso?.salon_codigo ?? '') || '',
        salonBloque: String(salon?.bloque ?? anyCurso?.salon_bloque ?? '') || '',
        salonNumero: salon?.numero_salon ?? anyCurso?.salon_numero ?? null,
      });
    }

    rows.sort((a, b) => `${a.cursoNombre}`.localeCompare(`${b.cursoNombre}`));
    return rows;
  }

  private rebuildAsignaciones() {
    const raw = this.asignacionesRaw;
    const cursosRaw: any[] = this.cursos() as any;
    const salonesRaw: any[] = this.salonesRegistrados() as any;

    // Si el endpoint devolvió vacío, intentar fallback desde /cursos
    if (!raw || raw.length === 0) {
      const rows = this.rebuildAsignacionesFromCursosFallback();
      this.salonesAsignados.set(rows);
      this.buildUniqueSalonesFromAsignados(rows);
      return;
    }

    const cursosById = new Map<number, any>();
    for (const c of cursosRaw) {
      const id = Number(this.pickFirstDefined(c, ['id', 'curso_id', 'id_curso', 'cursoId']));
      if (Number.isFinite(id) && id > 0) cursosById.set(id, c);
    }

    const salonesById = new Map<number, any>();
    for (const s of salonesRaw) {
      const id = Number(this.pickFirstDefined(s, ['id', 'salon_id', 'id_salon', 'salonId']));
      if (Number.isFinite(id) && id > 0) salonesById.set(id, s);
    }

    const rows: AsignacionRow[] = [];
    for (const r of raw) {
      const nestedAsignacion =
        r?.salon_curso && typeof r.salon_curso === 'object'
          ? r.salon_curso
          : r?.salonCurso && typeof r.salonCurso === 'object'
            ? r.salonCurso
            : r?.asignacion && typeof r.asignacion === 'object'
              ? r.asignacion
              : undefined;

      const asignacionId = Number(
        (this.pickFirstDefined(r, ['id', 'asignacionId', 'salonCursoId', 'salon_curso_id', 'id_salon_curso', 'asignacion_id']) ??
          this.pickFirstDefined(nestedAsignacion, ['id', 'asignacionId', 'salonCursoId', 'salon_curso_id', 'id_salon_curso', 'asignacion_id']))
      );

      const cursoObj = r?.curso && typeof r.curso === 'object' ? r.curso : undefined;
      const salonObj = r?.salon && typeof r.salon === 'object' ? r.salon : undefined;

      const cursoIdCandidate = this.pickFirstDefined(r, ['curso_id', 'cursoId', 'id_curso', 'curso', 'curso_fk']);
      const cursoId = Number(
        typeof cursoIdCandidate === 'object'
          ? this.pickFirstDefined(cursoIdCandidate, ['id', 'curso_id', 'cursoId', 'id_curso'])
          : (cursoIdCandidate ?? this.pickFirstDefined(cursoObj, ['id', 'curso_id', 'cursoId', 'id_curso']))
      );

      const salonIdCandidate = this.pickFirstDefined(r, ['salon_id', 'salonId', 'id_salon', 'salon', 'salon_fk']);
      const salonId = Number(
        typeof salonIdCandidate === 'object'
          ? this.pickFirstDefined(salonIdCandidate, ['id', 'salon_id', 'salonId', 'id_salon'])
          : (salonIdCandidate ?? this.pickFirstDefined(salonObj, ['id', 'salon_id', 'salonId', 'id_salon']))
      );

      if (!Number.isFinite(cursoId) || cursoId <= 0) continue;
      if (!Number.isFinite(salonId) || salonId <= 0) continue;

      const cursoRef = cursosById.get(cursoId) ?? cursoObj;
      const salonRef = salonesById.get(salonId) ?? salonObj;

      const cursoNombre =
        String(
          this.pickFirstDefined(r, ['curso_nombre', 'cursoNombre', 'nombre_curso', 'nombreCurso']) ??
            this.pickFirstDefined(cursoObj, ['nombre', 'nombre_curso', 'curso_nombre', 'name']) ??
            this.pickFirstDefined(cursoRef, ['nombre', 'nombre_curso', 'curso_nombre', 'name']) ??
            'Curso',
        )
          .trim();

      const cursoCodigo =
        String(
          this.pickFirstDefined(r, ['curso_codigo', 'cursoCodigo', 'codigo_curso', 'codigoCurso']) ??
            this.pickFirstDefined(cursoObj, ['codigo', 'codigo_curso', 'curso_codigo']) ??
            this.pickFirstDefined(cursoRef, ['codigo', 'codigo_curso', 'curso_codigo']) ??
            '',
        )
          .trim();

      const salonNombre =
        String(
          this.pickFirstDefined(r, ['salon_nombre', 'salonNombre', 'nombre_salon', 'nombreSalon']) ??
            this.pickFirstDefined(salonObj, ['nombre', 'salon_nombre', 'name']) ??
            this.pickFirstDefined(salonRef, ['nombre', 'salon_nombre', 'name']) ??
            `Salón ${salonId}`,
        )
          .trim();

      const salonCodigo =
        String(
          this.pickFirstDefined(r, ['salon_codigo', 'salonCodigo', 'codigo_salon', 'codigoSalon']) ??
            this.pickFirstDefined(salonObj, ['codigo', 'codigo_salon', 'salon_codigo']) ??
            this.pickFirstDefined(salonRef, ['codigo', 'codigo_salon', 'salon_codigo']) ??
            '',
        )
          .trim();

      const salonBloque =
        String(
          this.pickFirstDefined(r, ['bloque', 'salon_bloque', 'salonBloque', 'bloque_salon']) ??
            this.pickFirstDefined(salonObj, ['bloque']) ??
            this.pickFirstDefined(salonRef, ['bloque']) ??
            '',
        )
          .trim();

      const salonNumeroRaw =
        this.pickFirstDefined(r, ['numero_salon', 'salonNumero', 'salon_numero', 'numero', 'salon_numero_salon']) ??
        this.pickFirstDefined(salonObj, ['numero_salon', 'numero', 'salon_numero']) ??
        this.pickFirstDefined(salonRef, ['numero_salon', 'numero', 'salon_numero']);

      const salonNumero =
        salonNumeroRaw === null || salonNumeroRaw === undefined || String(salonNumeroRaw).trim() === ''
          ? null
          : Number.isFinite(Number(salonNumeroRaw))
            ? Number(salonNumeroRaw)
            : null;

      rows.push({
        asignacionId: Number.isFinite(asignacionId) && asignacionId > 0 ? asignacionId : null,
        cursoId,
        cursoNombre,
        cursoCodigo,
        salonId,
        salonNombre,
        salonCodigo,
        salonBloque,
        salonNumero,
      });
    }

    rows.sort((a, b) => `${a.cursoNombre}`.localeCompare(`${b.cursoNombre}`));
    this.salonesAsignados.set(rows);
    this.buildUniqueSalonesFromAsignados(rows);
  }

  submitSalon() {
    if (this.salonForm.invalid) {
      this.salonForm.markAllAsTouched();
      return;
    }

    const value = this.salonForm.getRawValue();
    const payload: any = {
      codigo: value.codigo.trim(),
      nombre: value.nombre.trim(),
      bloque: value.bloque.trim(),
      numero_salon: Number(value.numero_salon),
    };

    const id = this.editingId();
    if (id) {
      this.salonService
        .actualizar(id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.cancelSalon();
            this.loadSalones();
            this.activeTab.set('registrados');
          },
        });
      return;
    }

    this.salonService
      .registrar(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelSalon();
          this.loadSalones();
          this.activeTab.set('registrados');
        },
      });
  }

  editSalon(row: SalonRow) {
    if (!row.id) return;
    this.editingId.set(row.id);
    this.salonForm.setValue({
      codigo: row.codigo,
      nombre: row.nombre,
      bloque: row.bloque ?? '',
      numero_salon: row.numero_salon !== null && row.numero_salon !== undefined ? String(row.numero_salon) : '',
    });
    this.activeTab.set('registro');
  }

  removeSalon(row: SalonRow) {
    const id = row.id;
    if (!id) return;
    this.salonService
      .eliminar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadSalones(),
      });
  }

  cancelSalon() {
    this.editingId.set(null);
    this.salonForm.reset({ codigo: '', nombre: '', bloque: '', numero_salon: '' });
  }

  submitAsignacion() {
    if (this.asignacionForm.invalid) {
      this.asignacionForm.markAllAsTouched();
      return;
    }

    const value = this.asignacionForm.getRawValue();
    const cursoId = Number(value.cursoId);
    const salonId = Number(value.salonId);
    if (!Number.isFinite(cursoId) || cursoId <= 0) return;
    if (!Number.isFinite(salonId) || salonId <= 0) return;

    this.salonService
      .asignarSalonACurso({ cursoId, salonId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.asignacionForm.reset({ cursoId: '', salonId: '' });
          this.loadAsignaciones();
          this.loadCursos();
        },
        // manejar 409 en UI no es requisito; se deja en consola
        error: (err) => {
          console.error('Error al asignar salón a curso', err);
        },
      });
  }

  removeAsignacion(row: AsignacionRow) {
    const id = row.asignacionId;
    if (!id) return;
    this.salonService
      .desasignarSalonDeCurso(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadAsignaciones();
          this.loadCursos();
        },
      });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
