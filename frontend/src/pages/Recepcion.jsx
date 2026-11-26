import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clientesAPI, recepcionAPI } from '../services/api'
import { listarPrendas } from '../utils/catalogoPrendas'
import { Plus, Shirt, Trash2, X } from 'lucide-react'

const SERVICIOS = ['Lavado', 'Secado', 'Planchado', 'Lavado y planchado', 'Tintorería']

const SERVICIOS_EXTRA_KEY = 'lavanderia-servicios-extra'

const leerListaExtra = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fechaManana = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const Recepcion = () => {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [clienteId, setClienteId] = useState('')
  const [serviciosElegidos, setServiciosElegidos] = useState([])
  const [modalServicios, setModalServicios] = useState(false)
  const [fechaEntrega, setFechaEntrega] = useState(fechaManana)
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState([])
  const [prendas, setPrendas] = useState([])
  const [serviciosExtra, setServiciosExtra] = useState(() => leerListaExtra(SERVICIOS_EXTRA_KEY))
  const [nuevoServicioAbierto, setNuevoServicioAbierto] = useState(false)
  const [nuevoServicio, setNuevoServicio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = async () => {
    try {
      const [clientesRes, prendasLista] = await Promise.all([clientesAPI.getAll(), listarPrendas()])
      setClientes(Array.isArray(clientesRes.data) ? clientesRes.data : [])
      setPrendas(prendasLista)
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la recepción.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const total = useMemo(
    () => lineas.reduce((sum, linea) => sum + Number(linea.cantidad || 0) * Number(linea.precio || 0), 0),
    [lineas]
  )

  const serviciosDisponibles = [...SERVICIOS, ...serviciosExtra]

  const guardarServicioNuevo = () => {
    const nombre = nuevoServicio.trim()
    if (!nombre) {
      setError('Escribí el nombre del servicio.')
      return
    }
    const existente = serviciosDisponibles.find((item) => item.toLowerCase() === nombre.toLowerCase())
    if (!existente) {
      const siguientes = [...serviciosExtra, nombre]
      setServiciosExtra(siguientes)
      try {
        localStorage.setItem(SERVICIOS_EXTRA_KEY, JSON.stringify(siguientes))
      } catch {
        /* el listado sigue en esta sesión */
      }
    }
    const elegido = existente || nombre
    setServiciosElegidos((lista) => (lista.some((item) => item.toLowerCase() === elegido.toLowerCase()) ? lista : [...lista, elegido]))
    setNuevoServicio('')
    setNuevoServicioAbierto(false)
    setError('')
  }

  const alternarServicio = (nombre) => {
    setServiciosElegidos((lista) =>
      lista.some((item) => item.toLowerCase() === nombre.toLowerCase())
        ? lista.filter((item) => item.toLowerCase() !== nombre.toLowerCase())
        : [...lista, nombre]
    )
  }

  const agregarPrenda = (prenda) => {
    setAviso('')
    setError('')
    setLineas((lista) => [
      ...lista,
      {
        key: `${prenda.nombre}-${Date.now()}-${lista.length}`,
        prenda: prenda.nombre,
        cantidad: 1,
        precio: prenda.precio
      }
    ])
  }

  const cambiarLinea = (key, campo, valor) => {
    setLineas((lista) => lista.map((linea) => (linea.key === key ? { ...linea, [campo]: valor } : linea)))
  }

  const quitarLinea = (key) => {
    setLineas((lista) => lista.filter((linea) => linea.key !== key))
  }

  const registrar = async (e) => {
    e.preventDefault()
    if (!clienteId) {
      setError('Elegí un cliente.')
      return
    }
    if (!serviciosElegidos.length) {
      setError('Elegí al menos un servicio.')
      return
    }
    if (!lineas.length) {
      setError('Agregá al menos una prenda.')
      return
    }
    setGuardando(true)
    setError('')
    setAviso('')
    try {
      await recepcionAPI.crear({
        cliente_id: Number(clienteId),
        servicio: serviciosElegidos.join(', '),
        fecha_entrega: fechaEntrega,
        observaciones,
        items: lineas.map((linea) => ({
          prenda: linea.prenda,
          cantidad: Number(linea.cantidad),
          precio: Number(linea.precio)
        }))
      })
      setLineas([])
      setServiciosElegidos([])
      setObservaciones('')
      setFechaEntrega(fechaManana())
      setAviso('Pedido guardado. Lo encontrás en Pedidos.')
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el pedido.')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="loading-spinner" />
        <p className="text-slate-500 text-sm">Cargando recepción…</p>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h2 className="page-title">
          <Shirt className="text-brand-600 shrink-0" size={28} />
          Recepción
        </h2>
        <p className="page-subtitle">
          Recibí la ropa de un cliente, anotá el servicio y seguí el pedido hasta que lo retira.
        </p>
      </header>

      <div className="max-w-3xl">
        <form className="card p-5" onSubmit={registrar}>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Nuevo pedido</h3>

          {clientes.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Primero cargá un cliente en{' '}
              <Link to="/clientes" className="text-brand-600 font-semibold">
                Clientes
              </Link>
              .
            </p>
          ) : (
            <>
              <label className="label-field" htmlFor="recepcion-cliente">Cliente</label>
              <select
                id="recepcion-cliente"
                className="select-field mb-4"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
              >
                <option value="">Elegí un cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                    {cliente.telefono ? ` · ${cliente.telefono}` : ''}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="label-field">Servicios</p>
              <button
                type="button"
                className="input-field text-left"
                onClick={() => {
                  setError('')
                  setModalServicios(true)
                }}
              >
                {serviciosElegidos.length ? serviciosElegidos.join(', ') : 'Elegí uno o más'}
              </button>
            </div>
            <div>
              <label className="label-field" htmlFor="recepcion-fecha">Entrega prometida</label>
              <input
                id="recepcion-fecha"
                type="date"
                className="input-field"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
            </div>
          </div>

          <p className="label-field">Prendas</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {prendas.map((prenda) => (
              <button
                key={prenda.id}
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => agregarPrenda(prenda)}
              >
                <Plus size={14} />
                {prenda.nombre}
                <span className="text-slate-500">{fmtMoney(prenda.precio)}</span>
              </button>
            ))}
            {prendas.length === 0 && (
              <p className="text-sm text-slate-500">
                No hay prendas. Cargalas en la sección Prendas.
              </p>
            )}
          </div>

          {lineas.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">Todavía no hay prendas en este pedido.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {lineas.map((linea) => (
                <div key={linea.key} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input-field col-span-5"
                    value={linea.prenda}
                    aria-label="Prenda"
                    onChange={(e) => cambiarLinea(linea.key, 'prenda', e.target.value)}
                  />
                  <input
                    className="input-field col-span-2"
                    type="number"
                    min="1"
                    step="1"
                    value={linea.cantidad}
                    aria-label="Cantidad"
                    onChange={(e) => cambiarLinea(linea.key, 'cantidad', e.target.value)}
                  />
                  <p
                    className="col-span-3 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100"
                    aria-label="Precio"
                  >
                    {fmtMoney(linea.precio)}
                  </p>
                  <button
                    type="button"
                    className="col-span-2 justify-self-end p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    aria-label={`Quitar ${linea.prenda}`}
                    onClick={() => quitarLinea(linea.key)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="label-field" htmlFor="recepcion-notas">Observaciones</label>
          <textarea
            id="recepcion-notas"
            className="input-field mb-4 min-h-[80px]"
            placeholder="Manchas, prendas delicadas, sin blanqueador…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              Total {fmtMoney(total)}
            </p>
            <button type="submit" className="btn-primary" disabled={guardando || clientes.length === 0}>
              {guardando ? 'Guardando…' : 'Recibir ropa'}
            </button>
          </div>
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
          {aviso && <p className="text-sm text-emerald-600 mt-3">{aviso}</p>}
        </form>

        {modalServicios && (
          <div
            className="modal-scrim fixed inset-0 z-[90] flex items-center justify-center p-4"
            onClick={() => setModalServicios(false)}
          >
            <div
              className="modal-panel max-w-sm w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="servicios-titulo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 id="servicios-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    Servicios
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Podés elegir más de uno.</p>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Cerrar"
                  onClick={() => setModalServicios(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                {serviciosDisponibles.map((item) => {
                  const activo = serviciosElegidos.some((elegido) => elegido.toLowerCase() === item.toLowerCase())
                  return (
                    <label key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={activo}
                        onChange={() => alternarServicio(item)}
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item}</span>
                    </label>
                  )
                })}
              </div>

              {nuevoServicioAbierto ? (
                <div className="flex gap-2 mb-4">
                  <input
                    className="input-field"
                    placeholder="Nombre del servicio"
                    value={nuevoServicio}
                    aria-label="Nombre del servicio nuevo"
                    onChange={(e) => setNuevoServicio(e.target.value)}
                  />
                  <button type="button" className="btn-primary shrink-0" onClick={guardarServicioNuevo}>
                    Agregar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary btn-sm mb-4"
                  onClick={() => setNuevoServicioAbierto(true)}
                >
                  <Plus size={14} />
                  Nuevo servicio
                </button>
              )}

              <div className="flex justify-end">
                <button type="button" className="btn-primary" onClick={() => setModalServicios(false)}>
                  Listo
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Recepcion
