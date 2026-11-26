import { useEffect, useState } from 'react'
import { clientesAPI, recepcionAPI } from '../services/api'
import { ClipboardList } from 'lucide-react'

const ESTADOS = [
  { value: 'recibido', label: 'Recibido' },
  { value: 'en_lavado', label: 'En lavado' },
  { value: 'listo', label: 'Listo para retirar' },
  { value: 'entregado', label: 'Entregado' }
]

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtFecha = (valor) => {
  if (!valor) return 'Sin fecha'
  const texto = String(valor).slice(0, 10)
  const [y, m, d] = texto.split('-')
  if (!y || !m || !d) return texto
  return `${d}/${m}/${y}`
}

const fmtFechaHora = (valor) => {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return fmtFecha(valor)
  return fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

const TARJETAS_ESTADO = [{ value: '', label: 'Todos' }, ...ESTADOS]

const Pedidos = () => {
  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', clienteId: '' })
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = async (criterios = filtros) => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (criterios.desde) params.desde = criterios.desde
      if (criterios.hasta) params.hasta = criterios.hasta
      if (criterios.clienteId) params.cliente_id = criterios.clienteId
      const { data } = await recepcionAPI.listar(params)
      setPedidos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    clientesAPI
      .getAll()
      .then(({ data }) => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setClientes([]))
    cargar({ desde: '', hasta: '', clienteId: '' })
  }, [])

  const aplicarFiltros = (e) => {
    e.preventDefault()
    cargar(filtros)
  }

  const limpiar = () => {
    const vacios = { desde: '', hasta: '', clienteId: '' }
    setFiltros(vacios)
    cargar(vacios)
  }

  const pedidosVisibles = estadoFiltro
    ? pedidos.filter((pedido) => pedido.estado === estadoFiltro)
    : pedidos

  const cambiarEstado = async (pedido, estado) => {
    try {
      const { data } = await recepcionAPI.cambiarEstado(pedido.id, estado)
      setPedidos((lista) => lista.map((item) => (item.id === pedido.id ? { ...item, ...data, items: data.items || item.items } : item)))
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el estado.')
    }
  }

  return (
    <div>
      <header className="page-header">
        <h2 className="page-title">
          <ClipboardList className="text-brand-600 shrink-0" size={28} />
          Pedidos
        </h2>
        <p className="page-subtitle">
          Acá quedan los pedidos que se reciben. Elegí un estado, o filtrá por fecha y cliente.
        </p>
      </header>

      <form className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" onSubmit={aplicarFiltros}>
        <div>
          <label className="label-field" htmlFor="pedidos-desde">Desde</label>
          <input
            id="pedidos-desde"
            type="date"
            className="input-field"
            value={filtros.desde}
            onChange={(e) => setFiltros((prev) => ({ ...prev, desde: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="pedidos-hasta">Hasta</label>
          <input
            id="pedidos-hasta"
            type="date"
            className="input-field"
            value={filtros.hasta}
            onChange={(e) => setFiltros((prev) => ({ ...prev, hasta: e.target.value }))}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="label-field" htmlFor="pedidos-cliente">Cliente</label>
          <select
            id="pedidos-cliente"
            className="select-field"
            value={filtros.clienteId}
            onChange={(e) => setFiltros((prev) => ({ ...prev, clienteId: e.target.value }))}
          >
            <option value="">Todos los clientes</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">Filtrar</button>
          <button type="button" className="btn-secondary" onClick={limpiar}>Limpiar</button>
        </div>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {TARJETAS_ESTADO.map((estado) => {
          const cantidad = estado.value
            ? pedidos.filter((pedido) => pedido.estado === estado.value).length
            : pedidos.length
          const activo = estadoFiltro === estado.value
          return (
            <button
              key={estado.value || 'todos'}
              type="button"
              onClick={() => setEstadoFiltro(estado.value)}
              className={`card p-4 text-left transition ${
                activo
                  ? 'ring-2 ring-brand-600 border-brand-600 bg-brand-50 dark:bg-brand-950/30'
                  : 'hover:border-brand-300'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{estado.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{cantidad}</p>
            </button>
          )
        })}
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="loading-spinner" />
          <p className="text-slate-500 text-sm">Cargando pedidos…</p>
        </div>
      ) : pedidosVisibles.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No hay pedidos para esos filtros.</div>
      ) : (
        <div className="space-y-4">
          {pedidosVisibles.map((pedido) => {
            const items = Array.isArray(pedido.items) ? pedido.items : []
            return (
              <article key={pedido.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{pedido.cliente_nombre}</h3>
                    <p className="text-sm text-slate-500">
                      {pedido.cliente_telefono || 'Sin teléfono'}
                      {pedido.cliente_direccion ? ` · ${pedido.cliente_direccion}` : ''}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{fmtMoney(pedido.total)}</p>
                </div>

                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recibido</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-100">{fmtFechaHora(pedido.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entrega prometida</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-100">{fmtFecha(pedido.fecha_entrega)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servicios</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-100">{pedido.servicio}</dd>
                  </div>
                </dl>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Prenda</th>
                        <th className="py-2 pr-3 text-right">Cantidad</th>
                        <th className="py-2 pr-3 text-right">Precio</th>
                        <th className="py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-2 pr-3 text-slate-800 dark:text-slate-100">{item.prenda}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{Number(item.cantidad)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(item.precio)}</td>
                          <td className="py-2 text-right tabular-nums">{fmtMoney(Number(item.cantidad) * Number(item.precio))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pedido.observaciones && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{pedido.observaciones}</p>
                )}

                <div className="mt-4 max-w-xs">
                  <label className="label-field" htmlFor={`estado-${pedido.id}`}>Estado</label>
                  <select
                    id={`estado-${pedido.id}`}
                    className="select-field"
                    value={pedido.estado}
                    onChange={(e) => cambiarEstado(pedido, e.target.value)}
                  >
                    {ESTADOS.map((estado) => (
                      <option key={estado.value} value={estado.value}>{estado.label}</option>
                    ))}
                  </select>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Pedidos
