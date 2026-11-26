import { useEffect, useState } from 'react'
import { prendasAPI } from '../services/api'
import { listarPrendas } from '../utils/catalogoPrendas'
import { Plus, Shirt, Trash2 } from 'lucide-react'

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const Prendas = () => {
  const [prendas, setPrendas] = useState([])
  const [precios, setPrecios] = useState({})
  const [loading, setLoading] = useState(true)
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [nueva, setNueva] = useState({ nombre: '', precio: '' })
  const [error, setError] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)

  const cargar = async () => {
    try {
      const lista = await listarPrendas()
      setPrendas(lista)
      setPrecios(Object.fromEntries(lista.map((item) => [item.id, String(item.precio)])))
      setError('')
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar las prendas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const guardarPrecio = async (prenda) => {
    const precio = Number(String(precios[prenda.id] ?? '').replace(',', '.'))
    if (!Number.isFinite(precio) || precio < 0) {
      setError('El precio tiene que ser un número mayor o igual a 0.')
      setPrecios((prev) => ({ ...prev, [prenda.id]: String(prenda.precio) }))
      return
    }
    if (Number(prenda.precio) === precio) return
    setGuardandoId(prenda.id)
    setError('')
    try {
      const { data } = await prendasAPI.actualizar(prenda.id, { precio })
      setPrendas((lista) => lista.map((item) => (item.id === prenda.id ? data : item)))
      setPrecios((prev) => ({ ...prev, [prenda.id]: String(data.precio) }))
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el precio.')
      setPrecios((prev) => ({ ...prev, [prenda.id]: String(prenda.precio) }))
    } finally {
      setGuardandoId(null)
    }
  }

  const eliminar = async (prenda) => {
    if (!window.confirm(`¿Quitar ${prenda.nombre} del listado?`)) return
    setError('')
    try {
      await prendasAPI.eliminar(prenda.id)
      setPrendas((lista) => lista.filter((item) => item.id !== prenda.id))
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la prenda.')
    }
  }

  const agregar = async () => {
    const nombre = nueva.nombre.trim()
    if (!nombre) {
      setError('Escribí el nombre de la prenda.')
      return
    }
    const precio = Number(String(nueva.precio).replace(',', '.'))
    setError('')
    try {
      const { data } = await prendasAPI.crear({
        nombre,
        precio: Number.isFinite(precio) && precio >= 0 ? precio : 0
      })
      setPrendas((lista) => [...lista, data])
      setPrecios((prev) => ({ ...prev, [data.id]: String(data.precio) }))
      setNueva({ nombre: '', precio: '' })
      setNuevaAbierta(false)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo agregar la prenda.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="loading-spinner" />
        <p className="text-slate-500 text-sm">Cargando prendas…</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <header className="page-header">
        <h2 className="page-title">
          <Shirt className="text-brand-600 shrink-0" size={28} />
          Prendas
        </h2>
        <p className="page-subtitle">
          Acá se cargan las prendas y sus precios. En recepción solo se eligen para armar el pedido.
        </p>
      </header>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between gap-3">
          <span>Listado</span>
          <button type="button" className="btn-primary btn-sm" onClick={() => setNuevaAbierta((abierta) => !abierta)}>
            <Plus size={14} />
            Nueva prenda
          </button>
        </div>

        {nuevaAbierta && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
            <input
              className="input-field sm:col-span-6"
              placeholder="Nombre"
              value={nueva.nombre}
              aria-label="Nombre de la prenda nueva"
              onChange={(e) => setNueva((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <input
              className="input-field sm:col-span-3"
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio"
              value={nueva.precio}
              aria-label="Precio de la prenda nueva"
              onChange={(e) => setNueva((prev) => ({ ...prev, precio: e.target.value }))}
            />
            <button type="button" className="btn-primary sm:col-span-3" onClick={agregar}>
              Agregar
            </button>
          </div>
        )}

        {prendas.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No hay prendas en el listado.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {prendas.map((prenda) => (
              <li key={prenda.id} className="flex items-center gap-3 px-4 py-3">
                <p className="flex-1 min-w-0 font-medium text-slate-900 dark:text-slate-50 truncate">{prenda.nombre}</p>
                <input
                  className="input-field w-32 shrink-0"
                  type="number"
                  min="0"
                  step="0.01"
                  value={precios[prenda.id] ?? ''}
                  aria-label={`Precio de ${prenda.nombre}`}
                  disabled={guardandoId === prenda.id}
                  onChange={(e) => setPrecios((prev) => ({ ...prev, [prenda.id]: e.target.value }))}
                  onBlur={() => guardarPrecio(prenda)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
                <span className="hidden sm:block w-28 text-right text-sm text-slate-500 tabular-nums">
                  {fmtMoney(precios[prenda.id])}
                </span>
                <button
                  type="button"
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                  aria-label={`Eliminar ${prenda.nombre}`}
                  onClick={() => eliminar(prenda)}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="px-4 py-3 text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  )
}

export default Prendas
