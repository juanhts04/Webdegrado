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
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take } from 'rxjs/operators';
import { AsistenciaService } from '../../../services/asistencia';
import { DocenteService } from '../../../services/docentes';
import { ReconocimientoFacialService } from '../../../services/reconocimiento-facial-service';

type CursoOption = { id: number; nombre: string; codigo?: string };

type HistorialRow = {
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

type FaceBox = { top: number; right: number; bottom: number; left: number };

type ResultadoReconocimiento = {
  recognized: boolean;
  person?: string;
  confidence?: number;
};

@Component({
  selector: 'app-asistencia',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Asistencia implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly faceService = inject(ReconocimientoFacialService);
  private readonly docenteService = inject(DocenteService);
  private readonly asistenciaService = inject(AsistenciaService);

  @ViewChild('webVideo') webVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('webCanvas') webCanvas?: ElementRef<HTMLCanvasElement>;

  readonly activeTab = signal<'registro' | 'registrados'>('registro');

  readonly now = signal<Date>(new Date());
  private clockInterval?: number;

  readonly cargandoCursos = signal<boolean>(false);
  readonly cursos = signal<CursoOption[]>([]);

  readonly cargandoHistorial = signal<boolean>(false);
  readonly historial = signal<HistorialRow[]>([]);

  readonly resultado = signal<ResultadoReconocimiento | null>(null);
  readonly cameraOn = signal<boolean>(false);

  readonly toastMessage = signal<string | null>(null);
  private toastTimeout?: number;

  readonly registroForm = this.fb.nonNullable.group({
    cursoId: this.fb.nonNullable.control('todos'),
  });

  readonly historialForm = this.fb.nonNullable.group({
    cursoId: this.fb.nonNullable.control('todos'),
    busqueda: this.fb.nonNullable.control(''),
  });

  readonly historialFiltrado = computed(() => {
    const q = this.historialForm.controls.busqueda.value.toString().trim().toLowerCase();
    const cursoValue = this.historialForm.controls.cursoId.value;
    const cursoId = cursoValue === 'todos' ? null : Number(cursoValue);

    let data = [...this.historial()];
    if (cursoId && Number.isFinite(cursoId)) {
      data = data.filter((x) => Number(x?.curso_id) === cursoId);
    }
    if (q) {
      data = data.filter((x) => {
        const codigo = (x?.codigo ?? '').toString().toLowerCase();
        const nombre = (x?.nombre_completo ?? '').toString().toLowerCase();
        const curso = (x?.curso ?? '').toString().toLowerCase();
        const estado = (x?.estado ?? '').toString().toLowerCase();
        return codigo.includes(q) || nombre.includes(q) || curso.includes(q) || estado.includes(q);
      });
    }
    return data;
  });

  readonly fechaActualLabel = computed(() => {
    const date = this.now();
    try {
      return new Intl.DateTimeFormat('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  });

  readonly horaActualLabel = computed(() => {
    const date = this.now();
    try {
      return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  });

  private webStream?: MediaStream;
  private detectInterval?: number;
  private lastBox?: FaceBox;
  private stableFrames = 0;
  private recognizing = false;
  private detecting = false;
  private lastDetectErrorToastAt = 0;

  private readonly PERSON_COOLDOWN_MS = 8000;
  private readonly personNextAllowedAt = new Map<string, number>();

  private cameraOffTime: number | null = null;
  private readonly TIEMPO_MINIMO_SALIDA = 5 * 60 * 1000;

  private readonly DETECT_INTERVAL = 400;
  private readonly STABLE_THRESHOLD = 3;

  constructor() {
    if (!this.isBrowser) return;

    this.startClock();
    this.cargarCursos();

    this.historialForm.controls.cursoId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.activeTab() === 'registrados') this.cargarHistorial();
      });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    if (this.activeTab() === 'registro') {
      void this.startCamera();
    }
  }

  async ngOnDestroy(): Promise<void> {
    this.stopClock();
    this.clearToastTimeout();
    await this.stopCamera();
  }

  setActiveTab(tab: 'registro' | 'registrados') {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);

    if (!this.isBrowser) return;

    if (tab === 'registrados') {
      void this.stopCamera();
      this.cargarHistorial();
      return;
    }

    void this.startCamera();
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }

  async toggleCamera() {
    if (!this.isBrowser) return;

    if (!this.cameraOn() && this.cameraOffTime) {
      const diff = Date.now() - this.cameraOffTime;
      if (diff < this.TIEMPO_MINIMO_SALIDA) {
        const restante = Math.ceil((this.TIEMPO_MINIMO_SALIDA - diff) / 60000);
        this.toast(`Debe esperar ${restante} minuto(s) para salida`);
        return;
      }
    }

    if (this.cameraOn()) {
      await this.stopCamera();
      return;
    }

    await this.startCamera();
  }

  private startClock() {
    this.stopClock();
    this.now.set(new Date());
    this.clockInterval = window.setInterval(() => {
      this.now.set(new Date());
    }, 1000);
  }

  private stopClock() {
    if (this.clockInterval) {
      window.clearInterval(this.clockInterval);
      this.clockInterval = undefined;
    }
  }

  private clearToastTimeout() {
    if (this.toastTimeout) {
      window.clearTimeout(this.toastTimeout);
      this.toastTimeout = undefined;
    }
  }

  private toast(msg: string) {
    this.toastMessage.set(msg);
    this.clearToastTimeout();
    this.toastTimeout = window.setTimeout(() => this.toastMessage.set(null), 2000);
  }

  private getUsuarioFromStorage(): any | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private resolveDocenteId$() {
    const u = this.getUsuarioFromStorage();
    if (!u) return of(null);

    const direct = Number(u?.docente_id ?? u?.docenteId ?? u?.id_docente ?? u?.idDocente ?? u?.docente?.id);
    if (Number.isFinite(direct) && direct > 0) return of(direct);

    const correo = (u?.correo ?? u?.email ?? u?.usuario?.correo ?? u?.usuario?.email ?? '')
      .toString()
      .trim()
      .toLowerCase();
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
    )
      ?.toString?.()
      .trim?.();
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;

    const codigo = (
      src?.codigo ?? src?.codigoCurso ?? src?.codigo_curso ?? input?.codigo ?? input?.codigoCurso ?? input?.codigo_curso
    )
      ?.toString?.()
      .trim?.();
    return { id, nombre, ...(codigo ? { codigo } : {}) };
  }

  cargarCursos() {
    if (!this.isBrowser) return;

    this.cargandoCursos.set(true);
    this.registroForm.controls.cursoId.disable({ emitEvent: false });
    this.historialForm.controls.cursoId.disable({ emitEvent: false });

    const onOk = (data: any) => {
      const raw = Array.isArray(data) ? data : Array.isArray(data?.cursos) ? data.cursos : [];
      const normalized: CursoOption[] = raw
        .map((c: any) => this.normalizeCurso(c))
        .filter((c: CursoOption | null): c is CursoOption => !!c);
      this.cursos.set(normalized);

      if (normalized.length) {
        this.registroForm.controls.cursoId.enable({ emitEvent: false });
        this.historialForm.controls.cursoId.enable({ emitEvent: false });
      } else {
        this.registroForm.controls.cursoId.disable({ emitEvent: false });
        this.historialForm.controls.cursoId.disable({ emitEvent: false });
      }

      const registroSelected = this.registroForm.controls.cursoId.value;
      if (registroSelected !== 'todos') {
        const id = Number(registroSelected);
        if (!normalized.some((c) => c.id === id)) this.registroForm.controls.cursoId.setValue('todos');
      }

      const historialSelected = this.historialForm.controls.cursoId.value;
      if (historialSelected !== 'todos') {
        const id = Number(historialSelected);
        if (!normalized.some((c) => c.id === id)) this.historialForm.controls.cursoId.setValue('todos');
      }

      if (this.activeTab() === 'registrados') this.cargarHistorial();
      this.cargandoCursos.set(false);
    };

    const onErr = () => {
      this.cursos.set([]);
      this.registroForm.controls.cursoId.setValue('todos');
      this.historialForm.controls.cursoId.setValue('todos');
      this.registroForm.controls.cursoId.disable({ emitEvent: false });
      this.historialForm.controls.cursoId.disable({ emitEvent: false });
      this.cargandoCursos.set(false);
      this.toast('No se pudieron cargar los cursos');
    };

    this.resolveDocenteId$()
      .pipe(
        take(1),
        switchMap((id) => {
          if (!id) return of([]);
          return this.docenteService.listarCursosAsignados(id).pipe(catchError(() => of([])));
        }),
      )
      .subscribe({ next: onOk, error: onErr });
  }

  private extractTime(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toTimeString().slice(0, 8);
    }
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
    const hhmmss = text.match(/\b([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);
    if (hhmmss?.[0]) {
      const t = hhmmss[0];
      return t.length === 5 ? `${t}:00` : t;
    }
    const isoOrSql = text.match(/\b([01]\d|2[0-3]):[0-5]\d:[0-5]\d\b/);
    return isoOrSql?.[0] ?? undefined;
  }

  formatFecha(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
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

  private isPersonCoolingDown(person: string): boolean {
    const key = (person ?? '').toString().trim();
    if (!key) return false;
    const now = Date.now();
    const nextAllowedAt = this.personNextAllowedAt.get(key) ?? 0;
    if (now < nextAllowedAt) return true;

    if (this.personNextAllowedAt.size > 100) {
      for (const [k, t] of this.personNextAllowedAt.entries()) {
        if (now - t > 10 * this.PERSON_COOLDOWN_MS) this.personNextAllowedAt.delete(k);
      }
    }

    return false;
  }

  private setPersonCooldown(person: string, cooldownMs = this.PERSON_COOLDOWN_MS) {
    const key = (person ?? '').toString().trim();
    if (!key) return;
    this.personNextAllowedAt.set(key, Date.now() + Math.max(0, cooldownMs));
  }

  private getCursoSeleccionado(): number | null {
    const value = this.registroForm.controls.cursoId.value;
    if (value === 'todos') return null;
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private async startCamera() {
    if (!this.isBrowser) return;
    if (this.cameraOn()) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.toast('Este navegador no soporta cámara');
      return;
    }

    try {
      this.webStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      const video = this.webVideo?.nativeElement;
      if (!video) {
        this.toast('No se pudo iniciar la cámara');
        return;
      }

      video.srcObject = this.webStream;

      const playPromise = video.play();
      await this.waitForVideoReady(video, 1500);
      await playPromise;

      this.cameraOn.set(true);
      this.startDetectionLoop();
    } catch (err: any) {
      this.toast(this.humanizeCameraError(err));
      this.cameraOn.set(false);

      if (this.webStream) {
        this.webStream.getTracks().forEach((t) => t.stop());
        this.webStream = undefined;
      }
    }
  }

  async stopCamera() {
    if (!this.isBrowser) return;

    this.stopDetectionLoop();

    if (this.webStream) {
      this.webStream.getTracks().forEach((t) => t.stop());
      this.webStream = undefined;
    }

    const video = this.webVideo?.nativeElement;
    if (video) {
      video.srcObject = null;
    }

    this.cameraOn.set(false);
    this.recognizing = false;
    this.stableFrames = 0;
    this.lastBox = undefined;
    this.resultado.set(null);
    this.clearCanvas();

    this.cameraOffTime = Date.now();
  }

  private startDetectionLoop() {
    this.stopDetectionLoop();
    this.detectInterval = window.setInterval(() => {
      if (!this.cameraOn() || this.recognizing) return;
      this.detectFaceOnly();
    }, this.DETECT_INTERVAL);
  }

  private stopDetectionLoop() {
    if (this.detectInterval) {
      window.clearInterval(this.detectInterval);
      this.detectInterval = undefined;
    }
  }

  private detectFaceOnly() {
    if (this.detecting) return;

    const base64 = this.captureWebFrame();
    if (!base64) return;
    const blob = this.base64ToBlob(base64);

    this.detecting = true;

    this.faceService
      .detectarRostro(blob)
      .pipe(
        take(1),
        catchError((err) => {
          const now = Date.now();
          if (now - this.lastDetectErrorToastAt > 5000) {
            const status = err?.status;
            this.toast(status ? `Error detección (${status})` : 'Error conexión detección');
            this.lastDetectErrorToastAt = now;
          }
          console.error('[Asistencia] Error /detect', err);
          return of(null);
        }),
        finalize(() => {
          this.detecting = false;
        })
      )
      .subscribe((res: any) => {
        const parsed = this.parseDetectResponse(res);
        if (!parsed.faceDetected || !parsed.box) {
          this.clearCanvas();
          this.lastBox = undefined;
          this.stableFrames = 0;
          return;
        }

        this.drawFaceBox(parsed.box, false);

        if (this.isStable(parsed.box)) {
          this.stableFrames++;
          if (this.stableFrames >= this.STABLE_THRESHOLD) {
            this.recognizeFace(blob);
          }
        } else {
          this.stableFrames = 0;
        }

        this.lastBox = parsed.box;
      });
  }

  private waitForVideoReady(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
    if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();

    return new Promise((resolve) => {
      let done = false;

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('loadeddata', onData);
      };

      const finish = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      };

      const onMetadata = () => finish();
      const onData = () => finish();

      video.addEventListener('loadedmetadata', onMetadata, { once: true });
      video.addEventListener('loadeddata', onData, { once: true });

      window.setTimeout(() => finish(), Math.max(0, timeoutMs));
    });
  }

  private humanizeCameraError(err: any): string {
    const name = (err?.name ?? '').toString();
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Permiso de cámara denegado';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No se encontró cámara';
    if (name === 'NotReadableError') return 'No se pudo acceder a la cámara';
    if (name === 'OverconstrainedError') return 'Cámara no compatible con la configuración solicitada';
    return 'No se pudo iniciar la cámara';
  }

  private parseDetectResponse(res: any): { faceDetected: boolean; box?: FaceBox } {
    if (!res || typeof res !== 'object') return { faceDetected: false };

    const facesArray = Array.isArray((res as any).faces) ? (res as any).faces : null;
    const faceDetectedRaw =
      (res as any).faceDetected ??
      (res as any).detected ??
      (res as any).face_detected ??
      (res as any).hasFace;

    const faceDetected =
      Boolean(faceDetectedRaw) ||
      (Array.isArray(facesArray) && facesArray.length > 0) ||
      Boolean((res as any).box || (res as any).bbox || (res as any).faceBox || (res as any).face_box);

    const candidateBox =
      (res as any).box ??
      (res as any).bbox ??
      (res as any).faceBox ??
      (res as any).face_box ??
      (facesArray?.[0]?.box ?? facesArray?.[0]?.bbox ?? facesArray?.[0]?.faceBox ?? facesArray?.[0]?.face_box ?? facesArray?.[0]);

    const video = this.webVideo?.nativeElement;
    const vw = Number(video?.videoWidth ?? 0);
    const vh = Number(video?.videoHeight ?? 0);

    const box = this.normalizeBox(candidateBox, vw, vh);
    return box ? { faceDetected: true, box } : { faceDetected };
  }

  private normalizeBox(input: any, videoW: number, videoH: number): FaceBox | null {
    if (!input || typeof input !== 'object') return null;

    if (this.isFiniteNum(input.top) && this.isFiniteNum(input.right) && this.isFiniteNum(input.bottom) && this.isFiniteNum(input.left)) {
      return this.denormalizeIfNeeded(
        {
          top: Number(input.top),
          right: Number(input.right),
          bottom: Number(input.bottom),
          left: Number(input.left),
        },
        videoW,
        videoH
      );
    }

    if (this.isFiniteNum(input.x) && this.isFiniteNum(input.y) && this.isFiniteNum(input.w) && this.isFiniteNum(input.h)) {
      const left = Number(input.x);
      const top = Number(input.y);
      const right = left + Number(input.w);
      const bottom = top + Number(input.h);
      return this.denormalizeIfNeeded({ top, right, bottom, left }, videoW, videoH);
    }

    if (this.isFiniteNum(input.x) && this.isFiniteNum(input.y) && this.isFiniteNum(input.width) && this.isFiniteNum(input.height)) {
      const left = Number(input.x);
      const top = Number(input.y);
      const right = left + Number(input.width);
      const bottom = top + Number(input.height);
      return this.denormalizeIfNeeded({ top, right, bottom, left }, videoW, videoH);
    }

    if (this.isFiniteNum(input.left) && this.isFiniteNum(input.top) && this.isFiniteNum(input.width) && this.isFiniteNum(input.height)) {
      const left = Number(input.left);
      const top = Number(input.top);
      const right = left + Number(input.width);
      const bottom = top + Number(input.height);
      return this.denormalizeIfNeeded({ top, right, bottom, left }, videoW, videoH);
    }

    if (this.isFiniteNum(input.xMin) && this.isFiniteNum(input.yMin) && this.isFiniteNum(input.xMax) && this.isFiniteNum(input.yMax)) {
      return this.denormalizeIfNeeded(
        {
          left: Number(input.xMin),
          top: Number(input.yMin),
          right: Number(input.xMax),
          bottom: Number(input.yMax),
        },
        videoW,
        videoH
      );
    }

    return null;
  }

  private denormalizeIfNeeded(box: FaceBox, videoW: number, videoH: number): FaceBox {
    const max = Math.max(box.left, box.top, box.right, box.bottom);
    if (max <= 1.5 && videoW > 0 && videoH > 0) {
      return {
        left: box.left * videoW,
        right: box.right * videoW,
        top: box.top * videoH,
        bottom: box.bottom * videoH,
      };
    }
    return box;
  }

  private isFiniteNum(value: any): boolean {
    const n = Number(value);
    return Number.isFinite(n);
  }

  private isStable(box: FaceBox): boolean {
    if (!this.lastBox) return false;
    const dx = Math.abs(box.left - this.lastBox.left);
    const dy = Math.abs(box.top - this.lastBox.top);
    return dx < 15 && dy < 15;
  }

  private recognizeFace(blob: Blob) {
    this.recognizing = true;

    this.faceService
      .reconocerRostro(blob)
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          if (!res?.recognized) {
            this.resultado.set({ recognized: false });
            this.recognizing = false;
            this.stableFrames = 0;
            return;
          }

          this.resultado.set({
            recognized: true,
            person: (res?.person ?? '').toString(),
            confidence: Number(res?.confidence),
          });

          const cursoId = this.getCursoSeleccionado();
          if (!cursoId) {
            this.toast('Seleccione un curso');
            this.recognizing = false;
            this.stableFrames = 0;
            return;
          }

          const personKey = (res?.person ?? '').toString().trim();
          if (!personKey) {
            this.recognizing = false;
            this.stableFrames = 0;
            return;
          }

          if (this.isPersonCoolingDown(personKey)) {
            this.recognizing = false;
            this.stableFrames = 0;
            return;
          }

          this.asistenciaService
            .registrarAsistencia(cursoId, personKey)
            .pipe(take(1))
            .subscribe({
              next: (r: any) => {
                try {
                  this.setPersonCooldown(personKey);
                  const msg = String(r?.message ?? '');
                  if (msg.includes('Entrada')) {
                    this.toast('🟡 Entrada registrada');
                  } else if (msg.includes('Salida')) {
                    this.toast('🟢 Salida registrada');
                  } else if (msg) {
                    this.toast(msg);
                  }
                } finally {
                  this.recognizing = false;
                  this.stableFrames = 0;
                }
              },
              error: (err: any) => {
                try {
                  const status = err?.status;
                  if (status === 429) {
                    this.setPersonCooldown(personKey, 5 * 60 * 1000);
                  } else {
                    this.setPersonCooldown(personKey);
                  }

                  if (status === 429) this.toast('⏱ Debe esperar 5 min');
                  else if (status === 409) this.toast('✔ Ya completó asistencia');
                  else if (status === 403) this.toast('No pertenece al curso');
                  else this.toast('Error asistencia');
                } finally {
                  this.recognizing = false;
                  this.stableFrames = 0;
                }
              },
            });
        },
        error: () => {
          this.recognizing = false;
          this.stableFrames = 0;
        },
      });
  }

  private drawFaceBox(box: FaceBox, recognized: boolean) {
    const canvas = this.webCanvas?.nativeElement;
    const video = this.webVideo?.nativeElement;
    if (!canvas || !video) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;
    if (!displayWidth || !displayHeight || !video.videoWidth || !video.videoHeight) return;

    const scaleX = displayWidth / video.videoWidth;
    const scaleY = displayHeight / video.videoHeight;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const x = box.left * scaleX;
    const y = box.top * scaleY;
    const w = (box.right - box.left) * scaleX;
    const h = (box.bottom - box.top) * scaleY;

    ctx.strokeStyle = recognized ? '#00ff00' : '#ffcc00';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  private clearCanvas() {
    const canvas = this.webCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private captureWebFrame(): string | undefined {
    const video = this.webVideo?.nativeElement;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  }

  private base64ToBlob(base64: string): Blob {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      arr[i] = bytes.charCodeAt(i);
    }
    return new Blob([arr], { type: 'image/jpeg' });
  }

  formatConfidence(confidence: unknown): string {
    const num = Number(confidence);
    if (!Number.isFinite(num)) return '';
    return `${(num * 100).toFixed(2)}%`;
  }

  cargarHistorial() {
    if (!this.isBrowser) return;
    if (this.activeTab() !== 'registrados') return;

    const cursoValue = this.historialForm.controls.cursoId.value;
    const cursoId = cursoValue === 'todos' ? null : Number(cursoValue);

    if (cursoValue !== 'todos' && (!Number.isFinite(cursoId as any) || (cursoId as number) <= 0)) {
      this.historial.set([]);
      return;
    }

    if (cursoValue === 'todos' && !this.cursos().length) {
      this.historial.set([]);
      return;
    }

    this.cargandoHistorial.set(true);

    const toRows = (curso: CursoOption, res: any): HistorialRow[] => {
      const asistencias = Array.isArray(res?.asistencias) ? res.asistencias : [];
      return asistencias.map((a: any) => {
        const nombreCompleto = a?.nombre_completo ?? a?.nombreCompleto ?? a?.nombre ?? a?.estudiante_nombre;
        const horaInicioRaw = a?.hora_inicio ?? a?.horaInicio;
        const horaInicio = this.extractTime(horaInicioRaw) ?? (typeof horaInicioRaw === 'string' ? horaInicioRaw : undefined);
        const horaFin = a?.hora_fin ?? a?.horaFin ?? a?.hora_salida ?? a?.horaSalida ?? a?.hora_final ?? a?.horaFinal;
        const horaFinText = this.extractTime(horaFin) ?? (typeof horaFin === 'string' ? horaFin : undefined);
        return {
          ...a,
          nombre_completo: nombreCompleto,
          hora_inicio: horaInicio,
          hora_fin: horaFinText,
          curso: `${curso.codigo ? curso.codigo + ' - ' : ''}${curso.nombre}`,
          curso_id: curso.id,
        };
      });
    };

    if (cursoValue !== 'todos') {
      const curso = this.cursos().find((c) => c.id === cursoId) ?? ({ id: cursoId as number, nombre: '', codigo: '' } as CursoOption);
      this.asistenciaService
        .listarAsistenciasPorCurso(curso.id)
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            this.historial.set(toRows(curso, res));
            this.cargandoHistorial.set(false);
          },
          error: () => {
            this.historial.set([]);
            this.cargandoHistorial.set(false);
            this.toast('No se pudo cargar el historial');
          },
        });
      return;
    }

    const requests = this.cursos().map((c) =>
      this.asistenciaService.listarAsistenciasPorCurso(c.id).pipe(
        take(1),
        map((res) => toRows(c, res)),
        catchError(() => of([] as HistorialRow[])),
      ),
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (groups) => {
          const merged = (groups ?? []).reduce((acc: HistorialRow[], curr: HistorialRow[]) => acc.concat(curr), []);
          merged.sort((a, b) => {
            const ka = `${a?.fecha ?? ''} ${a?.hora_inicio ?? ''}`.trim();
            const kb = `${b?.fecha ?? ''} ${b?.hora_inicio ?? ''}`.trim();
            return kb.localeCompare(ka);
          });
          this.historial.set(merged);
          this.cargandoHistorial.set(false);
        },
        error: () => {
          this.historial.set([]);
          this.cargandoHistorial.set(false);
          this.toast('No se pudo cargar el historial');
        },
      });
  }
}
