import { useEffect, useState } from 'react'
import { clientesAPI } from '../services/api'
import { ArrowLeft, Contact, Pencil, Plus, Trash2, X } from 'lucide-react'

const FORM_VACIO = { id: null, nombre: '', telefono: '', direccion: '', notas: '' }

const Clientes = () => {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [fichaEdit, setFichaEdit] = useState([])
  const [cargandoFicha, setCargandoFicha] = useState(false)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [mensajeFicha, setMensajeFicha] = useState('')
  const [errorFicha, setErrorFicha] = useState('')

  const loadClientes = async () => {
    try {
      const response = await clientesAPI.getAll()
      setClientes(Array.isArray(response.data) ? response.data : [])
      setError('')
    } catch (err) {
      console.error('Error al cargar clientes:', err)
      setError('No se pudieron cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientes()
  }, [])

  const abrirNuevo = () => {
    setForm(FORM_VACIO)
    setErrorForm('')
    setShowModal(true)
  }

  const abrirEditar = (cliente) => {
    setForm({
      id: cliente.id,
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      notas: cliente.notas || ''
    })
    setErrorForm('')
    setShowModal(true)
  }

  const aplicarCliente = (data) => {
    setSeleccionado(data)
    setFichaEdit(Array.isArray(data?.ficha) ? data.ficha.map((item) => ({ ...item })) : [])
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setErrorForm('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setErrorForm('')
    try {
      if (form.id) {
        const { data } = await clientesAPI.update(form.id, form)
        setShowModal(false)
        await loadClientes()
        if (seleccionado?.id === data.id) aplicarCliente(data)
      } else {
        const { data } = await clientesAPI.create(form)
        setShowModal(false)
        await loadClientes()
        aplicarCliente(data)
      }
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'No se pudo guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  const abrirFicha = async (cliente) => {
    setCargandoFicha(true)
    setMensajeFicha('')
    setErrorFicha('')
    setSeleccionado(cliente)
    setFichaEdit([])
    try {
      const { data } = await clientesAPI.getById(cliente.id)
      aplicarCliente(data)
    } catch (err) {
      console.error('Error al abrir la ficha:', err)
      setError('No se pudo abrir la ficha del cliente.')
      setSeleccionado(null)
    } finally {
      setCargandoFicha(false)
    }
  }

  const guardarFicha = async () => {
    if (!seleccionado?.id) return
    setGuardandoFicha(true)
    setMensajeFicha('')
    setErrorFicha('')
    try {
      const { data } = await clientesAPI.updateFicha(
        seleccionado.id,
        fichaEdit.map((item) => ({ id: item.id, detalle: item.detalle }))
      )
      aplicarCliente(data)
      setMensajeFicha('Detalles guardados.')
    } catch (err) {
      setErrorFicha(err.response?.data?.error || 'No se pudieron guardar los detalles.')
    } finally {
      setGuardandoFicha(false)
    }
  }

  const cambiarDetalle = (id, detalle) => {
    setMensajeFicha('')
    setFichaEdit((lista) => lista.map((item) => (item.id === id ? { ...item, detalle } : item)))
  }

  const eliminar = async (cliente) => {
    if (!window.confirm(`¿Eliminar a ${cliente.nombre}?`)) return
    try {
      await clientesAPI.delete(cliente.id)
      if (seleccionado?.id === cliente.id) setSeleccionado(null)
      await loadClientes()
    } catch (err) {
      window.alert(err.response?.data?.error || 'No se pudo eliminar el cliente.')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="loading-spinner" />
        <p className="text-slate-500 text-sm">Cargando clientes…</p>
      </div>
    )
  }

  if (seleccionado) {
    return (
      <div>
        <div className="page-toolbar">
          <div>
            <button
              type="button"
              onClick={() => setSeleccionado(null)}
              className="btn-secondary btn-sm mb-3"
            >
              <ArrowLeft size={16} />
              Volver al listado
            </button>
            <h2 className="page-title">{seleccionado.nombre}</h2>
            <p className="page-subtitle">
              Corregí los datos del cliente y el detalle de cada ítem de la ficha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => abrirEditar(seleccionado)}>
              <Pencil size={18} />
              Editar cliente
            </button>
            <button type="button" className="btn-danger" onClick={() => eliminar(seleccionado)}>
              <Trash2 size={18} />
              Eliminar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono</p>
            <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.telefono || '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección</p>
            <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.direccion || '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</p>
            <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.notas || '—'}</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between gap-3">
            <span>Qué se tiene en cuenta</span>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={guardarFicha}
              disabled={guardandoFicha || cargandoFicha}
            >
              {guardandoFicha ? 'Guardando…' : 'Guardar detalles'}
            </button>
          </div>
          {cargandoFicha ? (
            <p className="p-6 text-sm text-slate-500">Cargando ficha…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-5 py-3 w-[34%]">Concepto</th>
                    <th className="px-5 py-3">Detalle de muestra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {fichaEdit.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100 align-top">
                        {item.concepto}
                      </td>
                      <td className="px-5 py-3">
                        <input
                          className="input-field"
                          value={item.detalle || ''}
                          aria-label={`Detalle de ${item.concepto}`}
                          onChange={(e) => cambiarDetalle(item.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(mensajeFicha || errorFicha) && (
            <p className={`px-5 py-3 text-sm ${errorFicha ? 'text-rose-600' : 'text-emerald-600'}`}>
              {errorFicha || mensajeFicha}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-toolbar">
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="page-subtitle">Alta de clientes y ficha de ejemplo para la lavandería.</p>
        </div>
        <button type="button" onClick={abrirNuevo} className="btn-primary">
          <Plus size={20} />
          Nuevo cliente
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-rose-600">{error}</p>
      )}

      {clientes.length === 0 ? (
        <div className="card p-12 text-center">
          <Contact className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-600 dark:text-slate-300">Todavía no hay clientes cargados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clientes.map((cliente) => (
            <div key={cliente.id} className="card p-5 flex flex-col">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{cliente.nombre}</h3>
              <p className="text-sm text-slate-500 mt-1">{cliente.telefono || 'Sin teléfono'}</p>
              {cliente.direccion && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{cliente.direccion}</p>
              )}
              <p className="text-xs text-slate-400 mt-3">{cliente.total_items || 0} datos en la ficha</p>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => abrirEditar(cliente)}>
                  <Pencil size={16} />
                  Editar
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={() => abrirFicha(cliente)}>
                  Ver ficha
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Eliminar"
                  onClick={() => eliminar(cliente)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="modal-scrim fixed inset-0 z-[90] flex items-center justify-center p-4"
          onClick={() => !guardando && setShowModal(false)}
        >
          <form
            className="modal-panel max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {form.id ? 'Editar cliente' : 'Nuevo cliente'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {form.id
                    ? 'Actualizá el nombre y los datos de contacto.'
                    : 'Al guardarlo se arma una ficha de muestra con lo que suele registrarse en una lavandería.'}
                </p>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setShowModal(false)}
                disabled={guardando}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <label className="label-field" htmlFor="cliente-nombre">Nombre</label>
            <input
              id="cliente-nombre"
              className="input-field mb-3"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              required
              autoFocus
            />

            <label className="label-field" htmlFor="cliente-telefono">Teléfono</label>
            <input
              id="cliente-telefono"
              className="input-field mb-3"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />

            <label className="label-field" htmlFor="cliente-direccion">Dirección</label>
            <input
              id="cliente-direccion"
              className="input-field mb-3"
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            />

            <label className="label-field" htmlFor="cliente-notas">Notas</label>
            <textarea
              id="cliente-notas"
              className="input-field mb-4 min-h-[88px]"
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />

            {errorForm && <p className="text-sm text-rose-600 mb-3">{errorForm}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Clientes
