import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { EstudiantesService } from '../../../services/estudiantes';
import { ProgramasAcademicosService } from '../../../services/programas-academicos';

type ProgramaAcademico = {
  id: string;
  nombre: string;
};

type EstudianteBiometriaRow = {
  id: string;
  codigo: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  programaId: string;
  programaNombre: string;
  semestre: string;
  fotoDataUrl?: string;
  fechaRegistro: string;
};

@Component({
  selector: 'app-registrar-biometria',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-biometria.html',
  styleUrl: './registrar-biometria.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrarBiometria {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly estudiantesService = inject(EstudiantesService);
  private readonly programasService = inject(ProgramasAcademicosService);

  readonly activeTab = signal<'registro' | 'registrados'>('registro');
  readonly placeholderAvatar = 'https://ionicframework.com/docs/img/demos/avatar.svg';
  readonly photoPreview = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly query = signal<string>('');

  readonly programasAcademicos = signal<ProgramaAcademico[]>([]);

  readonly registrados = signal<EstudianteBiometriaRow[]>([]);

  readonly cargando = signal(false);

  readonly filteredEstudiantes = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.registrados();
    if (!q) return rows;
    return rows.filter((e) => {
      return (
        e.codigo.toLowerCase().includes(q) ||
        e.nombreCompleto.toLowerCase().includes(q) ||
        e.cedula.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.programaNombre.toLowerCase().includes(q)
      );
    });
  });

  readonly form = this.fb.nonNullable.group({
    codigo: this.fb.nonNullable.control('', [Validators.required]),
    nombreCompleto: this.fb.nonNullable.control('', [Validators.required]),
    cedula: this.fb.nonNullable.control('', [Validators.required]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    password: this.fb.nonNullable.control('', [Validators.required]),
    programaId: this.fb.nonNullable.control('', [Validators.required]),
    semestre: this.fb.nonNullable.control('', [Validators.required]),
  });

  ngOnInit(): void {
    this.cargarDesdeApi();
  }

  setTab(tab: 'registro' | 'registrados') {
    this.activeTab.set(tab);
  }

  private cargarDesdeApi(): void {
    if (!this.isBrowser) return;
    this.cargando.set(true);

    forkJoin({
      programas: this.programasService.listar().pipe(catchError(() => of([] as any[]))),
      estudiantes: this.estudiantesService.listar().pipe(catchError(() => of([] as any[]))),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ programas, estudiantes }) => {
          const programasList = (Array.isArray(programas) ? programas : [])
            .map((p: any) => ({
              id: String(p?.id ?? p?.programaId ?? p?.programa_id ?? ''),
              nombre: String(p?.nombre ?? p?.programa ?? p?.name ?? '—'),
            }))
            .filter((p: ProgramaAcademico) => !!p.id);

          const programaNombreById = new Map(programasList.map((p) => [p.id, p.nombre] as const));

          const rowsRaw = Array.isArray(estudiantes) ? estudiantes : [];
          const list = rowsRaw.reduce<EstudianteBiometriaRow[]>((acc, e: any) => {
            const id = String(e?.id ?? e?.estudianteId ?? e?.id_estudiante ?? e?.idEstudiante ?? '');
            if (!id) return acc;

            const codigo = String(e?.codigo ?? e?.codigo_estudiante ?? e?.codigoEstudiante ?? '').trim();
            const nombreCompleto = String(
              e?.nombreCompleto ?? e?.nombre_completo ?? e?.nombre ?? e?.fullName ?? e?.nombres ?? '',
            ).trim();
            const cedula = String(e?.cedula ?? e?.documento ?? e?.dni ?? '').trim();
            const email = String(e?.email ?? e?.correo ?? e?.mail ?? '').trim();
            const programaId = String(
              e?.programaId ?? e?.programa_id ?? e?.programa ?? e?.programaAcademicoId ?? '',
            ).trim();

            const programaNombreDirecto = String(
              e?.programaNombre ?? e?.programa_nombre ?? e?.programaAcademico?.nombre ?? '',
            ).trim();
            const programaNombre = programaNombreDirecto || programaNombreById.get(programaId) || '—';

            const semestreRaw = e?.semestre ?? e?.semestre_cursante ?? e?.nivel ?? '';
            const semestre = String(semestreRaw ?? '').trim() || '—';

            const fotoDataUrl: string | undefined =
              (typeof e?.fotoDataUrl === 'string' && e.fotoDataUrl) ||
              (typeof e?.foto === 'string' && e.foto.startsWith('data:') ? e.foto : undefined) ||
              undefined;

            const fechaRaw = e?.fechaRegistro ?? e?.fecha_registro ?? e?.createdAt ?? e?.created_at ?? e?.fecha;
            const fechaRegistro = this.formatFecha(fechaRaw);

            acc.push({
              id,
              codigo: codigo || '—',
              nombreCompleto: nombreCompleto || '—',
              cedula: cedula || '—',
              email: email || '—',
              programaId,
              programaNombre,
              semestre,
              fotoDataUrl,
              fechaRegistro,
            });
            return acc;
          }, []);

          this.programasAcademicos.set(programasList);
          this.registrados.set(list);
          this.cargando.set(false);
        },
        error: () => {
          this.programasAcademicos.set([]);
          this.registrados.set([]);
          this.cargando.set(false);
        },
      });
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

  setQuery(value: string) {
    this.query.set(value);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.photoPreview.set(result);
    };
    reader.readAsDataURL(file);
  }

  submit() {
    const editing = this.editingId();
    if (editing) {
      // En edición, password no es obligatorio.
      this.form.controls.password.setValidators([]);
      this.form.controls.password.updateValueAndValidity({ emitEvent: false });
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!editing && !this.photoPreview()) {
      // En registro nuevo, la foto es obligatoria (como en Ionic).
      return;
    }

    const value = this.form.getRawValue();

    const payload: any = {
      codigo: value.codigo.trim(),
      nombreCompleto: value.nombreCompleto.trim(),
      cedula: value.cedula.trim(),
      email: value.email.trim(),
      ...(value.password?.trim() ? { password: value.password.trim() } : {}),
      programaId: Number.isFinite(Number(value.programaId)) ? Number(value.programaId) : value.programaId,
      semestre: value.semestre.trim(),
      ...(this.photoPreview() ? { foto: this.photoPreview() } : {}),
    };

    if (editing) {
      const idNum = this.toNumberId(editing);
      if (!idNum) return;
      this.estudiantesService
        .actualizar(idNum, payload)
        .pipe(take(1), catchError(() => of(null)))
        .subscribe(() => {
          this.editingId.set(null);
          this.photoPreview.set(null);
          this.resetForm();
          this.cargarDesdeApi();

          this.activeTab.set('registrados');
        });
      return;
    }

    this.estudiantesService
      .registrar(payload)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => {
        this.photoPreview.set(null);
        this.resetForm();
        this.cargarDesdeApi();

        this.activeTab.set('registrados');
      });
  }

  edit(id: string) {
    const row = this.registrados().find((r) => r.id === id);
    if (!row) return;
    this.editingId.set(id);
    this.photoPreview.set(row.fotoDataUrl ?? null);
    this.form.setValue({
      codigo: row.codigo,
      nombreCompleto: row.nombreCompleto,
      cedula: row.cedula,
      email: row.email,
      password: '',
      programaId: row.programaId,
      semestre: row.semestre,
    });
    this.form.controls.password.setValidators([]);
    this.form.controls.password.updateValueAndValidity({ emitEvent: false });

    this.activeTab.set('registro');
  }

  remove(id: string) {
    const idNum = this.toNumberId(id);
    if (!idNum) return;
    this.estudiantesService
      .eliminar(idNum)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => {
        if (this.editingId() === id) {
          this.cancel();
        }
        this.cargarDesdeApi();
      });
  }

  cancel() {
    this.editingId.set(null);
    this.photoPreview.set(null);
    this.resetForm();

    this.activeTab.set('registro');
  }

  private resetForm() {
    this.form.reset({
      codigo: '',
      nombreCompleto: '',
      cedula: '',
      email: '',
      password: '',
      programaId: '',
      semestre: '',
    });
    // Volver a requerir password para registro nuevo
    this.form.controls.password.setValidators([Validators.required]);
    this.form.controls.password.updateValueAndValidity({ emitEvent: false });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
