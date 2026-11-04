import { useCallback, useEffect, useMemo, useState } from 'react'
import { Store, Search } from 'lucide-react'
import { movimientosAPI } from '../services/api'
import { hoyLocalISO } from '../utils/fechas'
import { fmtCantidadStock } from '../utils/unidades'

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtFecha = (d) => {
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  return x.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const inicioMesISO = () => `${hoyLocalISO().slice(0, 8)}01`

const importeLinea = (m) => {
  const q = Number(m.cantidad)
  const p = Number(m.precio_unitario)
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0
  return Math.round(q * p * 100) / 100
}

const UsoNegocio = () => {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState(inicioMesISO)
  const [hasta, setHasta] = useState(hoyLocalISO)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await movimientosAPI.getUsoNegocio({
        desde: desde || undefined,
        hasta: hasta || undefined,
        limit: 5000
      })
      setFilas(Array.isArray(data) ? data : [])
    } catch (e) {
      setFilas([])
      setError(e.response?.data?.error || 'No se pudo cargar el uso en el negocio')
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return filas
    return filas.filter((m) => {
      const texto = [m.producto_nombre, m.producto_codigo, m.usuario, m.motivo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return texto.includes(t)
    })
  }, [filas, busqueda])

  const total = useMemo(
    () => visibles.reduce((s, m) => s + importeLinea(m), 0),
    [visibles]
  )

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Store size={26} className="text-violet-600" />
          Uso en el negocio
        </h1>
      </header>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
        <label className="flex-1">
          <span className="text-xs font-medium text-gray-600 block mb-1">Buscar</span>
          <span className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Producto, código o usuario"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </span>
        </label>
        <label>
          <span className="text-xs font-medium text-gray-600 block mb-1">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-gray-600 block mb-1">Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
        </label>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-violet-800">
          {visibles.length} movimiento{visibles.length === 1 ? '' : 's'}
        </p>
        <p className="text-sm font-semibold text-violet-800 tabular-nums">
          Valor de lista: {fmtMoney(total)}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-12">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No hay mercadería de uso en el negocio en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Producto</th>
                  <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map((m) => (
                  <tr key={m.id} className="hover:bg-violet-50/40">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtFecha(m.fecha)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">{m.producto_nombre}</div>
                      {m.producto_codigo && (
                        <div className="text-xs text-gray-500">{m.producto_codigo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      {fmtCantidadStock(m.cantidad, m.unidad_medida)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                      {fmtMoney(importeLinea(m))}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.usuario || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default UsoNegocio
