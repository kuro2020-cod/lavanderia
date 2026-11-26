import { prendasAPI } from '../services/api'

const PRENDAS_KEY = 'lavanderia-prendas'
const SYNC_KEY = 'lavanderia-prendas-sync'

const leerLocal = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRENDAS_KEY) || 'null')
    if (!Array.isArray(parsed)) return null
    return parsed
      .map((item) => ({
        nombre: String(item?.nombre || '').trim(),
        precio: Number(item?.precio)
      }))
      .filter((item) => item.nombre && Number.isFinite(item.precio) && item.precio >= 0)
  } catch {
    return null
  }
}

/** Trae el listado compartido y, una sola vez, incorpora los precios guardados en este navegador. */
export async function listarPrendas() {
  const { data } = await prendasAPI.listar()
  let lista = Array.isArray(data) ? data : []
  if (localStorage.getItem(SYNC_KEY)) return lista

  const local = leerLocal()
  if (local) {
    const porNombre = new Map(lista.map((item) => [String(item.nombre).toLowerCase(), item]))
    const nombresLocales = new Set(local.map((item) => item.nombre.toLowerCase()))
    for (const actual of lista) {
      if (!nombresLocales.has(String(actual.nombre).toLowerCase())) {
        await prendasAPI.eliminar(actual.id)
      }
    }
    const resultado = []
    for (const item of local) {
      const existente = porNombre.get(item.nombre.toLowerCase())
      if (!existente) {
        const { data: creada } = await prendasAPI.crear(item)
        resultado.push(creada)
      } else if (Number(existente.precio) !== item.precio) {
        const { data: actualizada } = await prendasAPI.actualizar(existente.id, { precio: item.precio })
        resultado.push(actualizada)
      } else {
        resultado.push(existente)
      }
    }
    lista = resultado
  }

  try {
    localStorage.setItem(SYNC_KEY, '1')
  } catch {
    /* la próxima visita vuelve a intentar */
  }
  return lista
}
