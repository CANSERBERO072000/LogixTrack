import * as XLSX from 'xlsx'

export interface FilaAranda {
  guia: string
  destinatario: string
  direccion: string
  telefono: string
  zona: string
  peso_kg: number | null
}

export interface ResultadoParseo {
  filasValidas: FilaAranda[]
  filasError: { fila: number; motivo: string; datosOriginales: unknown }[]
  totalFilas: number
}

export type EstadoConciliacion = 'conciliado' | 'faltante' | 'sobrante'

export interface FilaConciliacion extends FilaAranda {
  estado: EstadoConciliacion
  paquete_id?: string
  evidencia_url?: string
}

const ALIAS_COLUMNAS: Record<keyof FilaAranda, string[]> = {
  guia: ['guia', 'guía', 'numero_guia', 'no_guia', 'tracking', 'awb'],
  destinatario: ['destinatario', 'cliente', 'nombre_cliente', 'consignee'],
  direccion: ['direccion', 'dirección', 'address', 'domicilio'],
  telefono: ['telefono', 'teléfono', 'celular', 'phone'],
  zona: ['zona', 'sector', 'area', 'área', 'ruta'],
  peso_kg: ['peso', 'peso_kg', 'kg', 'weight'],
}

function normalizarEncabezado(h: string): string {
  return h.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')
}

function construirMapaColumnas(encabezados: string[]): Partial<Record<keyof FilaAranda, string>> {
  const normalizados = encabezados.map((h) => ({ original: h, norm: normalizarEncabezado(h) }))
  const mapa: Partial<Record<keyof FilaAranda, string>> = {}
  for (const campo of Object.keys(ALIAS_COLUMNAS) as (keyof FilaAranda)[]) {
    const alias = ALIAS_COLUMNAS[campo]
    const encontrado = normalizados.find((h) => alias.includes(h.norm))
    if (encontrado) mapa[campo] = encontrado.original
  }
  return mapa
}

export async function parsearManifiestoAranda(file: File): Promise<ResultadoParseo> {
  const filasValidas: FilaAranda[] = []
  const filasError: ResultadoParseo['filasError'] = []

  let workbook: XLSX.WorkBook
  try {
    const buffer = await file.arrayBuffer()
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return {
      filasValidas: [],
      filasError: [{ fila: 0, motivo: 'Archivo Excel corrupto o formato no soportado', datosOriginales: null }],
      totalFilas: 0,
    }
  }

  const hoja = workbook.Sheets[workbook.SheetNames[0]]
  if (!hoja) {
    return { filasValidas: [], filasError: [{ fila: 0, motivo: 'El archivo no contiene hojas', datosOriginales: null }], totalFilas: 0 }
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null })
  if (filas.length === 0) return { filasValidas: [], filasError: [], totalFilas: 0 }

  const encabezados = Object.keys(filas[0])
  const mapa = construirMapaColumnas(encabezados)

  const camposRequeridos: (keyof FilaAranda)[] = ['guia', 'zona']
  const faltantes = camposRequeridos.filter((c) => !mapa[c])
  if (faltantes.length > 0) {
    return {
      filasValidas: [],
      filasError: [{ fila: 0, motivo: `No se pudieron mapear columnas obligatorias: ${faltantes.join(', ')}.`, datosOriginales: encabezados }],
      totalFilas: filas.length,
    }
  }

  const guiasVistas = new Set<string>()
  filas.forEach((filaOriginal, idx) => {
    const numeroFila = idx + 2
    const guia = mapa.guia ? String(filaOriginal[mapa.guia] ?? '').trim() : ''
    const zona = mapa.zona ? String(filaOriginal[mapa.zona] ?? '').trim() : ''

    if (!guia) { filasError.push({ fila: numeroFila, motivo: 'Número de guía vacío', datosOriginales: filaOriginal }); return }
    if (guiasVistas.has(guia)) { filasError.push({ fila: numeroFila, motivo: `Guía duplicada: ${guia}`, datosOriginales: filaOriginal }); return }
    if (!zona) { filasError.push({ fila: numeroFila, motivo: 'Zona vacía', datosOriginales: filaOriginal }); return }

    let peso: number | null = null
    if (mapa.peso_kg && filaOriginal[mapa.peso_kg] != null) {
      const valor = Number(filaOriginal[mapa.peso_kg])
      peso = Number.isFinite(valor) ? valor : null
    }

    guiasVistas.add(guia)
    filasValidas.push({
      guia,
      destinatario: mapa.destinatario ? String(filaOriginal[mapa.destinatario] ?? '').trim() : '',
      direccion: mapa.direccion ? String(filaOriginal[mapa.direccion] ?? '').trim() : '',
      telefono: mapa.telefono ? String(filaOriginal[mapa.telefono] ?? '').trim() : '',
      zona,
      peso_kg: peso,
    })
  })

  return { filasValidas, filasError, totalFilas: filas.length }
}

export function exportarCierreAranda(filas: FilaConciliacion[], nombreArchivo = 'cierre_aranda'): void {
  const dataFormateada = filas.map((f) => ({
    'Número de Guía': f.guia,
    Destinatario: f.destinatario,
    Zona: f.zona,
    Estado: f.estado.toUpperCase(),
    'Peso (kg)': f.peso_kg ?? '',
    'Evidencia (URL)': f.evidencia_url ?? '',
  }))
  const hoja = XLSX.utils.json_to_sheet(dataFormateada)
  hoja['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 40 }]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Cierre')
  const fecha = new Date().toISOString().split('T')[0]
  XLSX.writeFile(libro, `${nombreArchivo}_${fecha}.xlsx`)
}

export async function calcularHashArchivo(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
