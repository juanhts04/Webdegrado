import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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

  readonly placeholderAvatar = 'https://ionicframework.com/docs/img/demos/avatar.svg';
  readonly photoPreview = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly query = signal<string>('');

  readonly programasAcademicos = signal<ProgramaAcademico[]>([
    { id: '1', nombre: 'Ingeniería de Software' },
    { id: '2', nombre: 'Ingeniería de Sistemas' },
    { id: '3', nombre: 'Administración' },
  ]);

  readonly registrados = signal<EstudianteBiometriaRow[]>([]);

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
    const programa = this.programasAcademicos().find((p) => p.id === value.programaId);
    const formatted = new Date().toLocaleDateString('es-CO');

    const row: EstudianteBiometriaRow = {
      id: editing ?? crypto.randomUUID(),
      codigo: value.codigo.trim(),
      nombreCompleto: value.nombreCompleto.trim(),
      cedula: value.cedula.trim(),
      email: value.email.trim(),
      programaId: value.programaId,
      programaNombre: programa?.nombre ?? '—',
      semestre: value.semestre.trim(),
      fotoDataUrl: this.photoPreview() ?? undefined,
      fechaRegistro: formatted,
    };

    if (editing) {
      this.registrados.update((rows) => rows.map((r) => (r.id === editing ? row : r)));
      this.editingId.set(null);
    } else {
      this.registrados.update((rows) => [row, ...rows]);
    }

    this.resetForm();
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
  }

  remove(id: string) {
    this.registrados.update((rows) => rows.filter((r) => r.id !== id));
    if (this.editingId() === id) {
      this.cancel();
    }
  }

  cancel() {
    this.editingId.set(null);
    this.photoPreview.set(null);
    this.resetForm();
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
