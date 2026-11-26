import { Link } from 'react-router-dom'
import { ArrowLeftRight, ChevronRight } from 'lucide-react'

const MovimientosHub = () => {
  return (
    <div className="max-w-3xl">
      <h2 className="page-title mb-2">Movimientos</h2>
      <p className="page-subtitle mb-8">Elegí qué información querés ver.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Link
          to="/movimientos/registro"
          className="group flex flex-col card p-6 transition-all hover:border-brand-300 hover:shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="rounded-xl bg-brand-100 p-3 text-brand-800">
              <ArrowLeftRight size={28} />
            </span>
            <ChevronRight className="text-gray-400 group-hover:text-brand-600 transition-colors" size={22} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">Movimientos</h3>
          <p className="mt-2 text-sm text-gray-600">
            Movimientos de stock y pagos a proveedores, con búsqueda, filtros y paginación.
          </p>
        </Link>
      </div>
    </div>
  )
}

export default MovimientosHub
