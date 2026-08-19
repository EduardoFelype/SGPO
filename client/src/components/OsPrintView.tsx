import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateTime, OS_STATUS_LABEL } from "@/lib/format";
import { LOGO_NORMAL } from "@/lib/brand";

interface OsPrintData {
  os: {
    id: number;
    number: string;
    status: string;
    openedAt: number;
    predictedAt: number | null;
    completedAt: number | null;
    mileage: number | null;
    diagnostics: string | null;
    observations: string | null;
    discount: number;
    totalAmount: number;
    customerName: string | null;
    customerWhatsapp: string | null;
    customerPhone: string | null;
    vehiclePlate: string | null;
    vehicleModel: string | null;
    vehicleBrand: string | null;
    vehicleYear: string | null;
    vehicleColor: string | null;
  };
  services: {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  products: {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }[];
}

export default function OsPrintView({ data }: { data: OsPrintData }) {
  const { os, services, products } = data;

  return (
    <div className="os-print bg-white text-black rounded-lg shadow-2xl p-8 sm:p-10 max-w-3xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-4 mb-6">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_NORMAL}
            alt="SGPO"
            className="h-14 w-auto object-contain print:h-12"
          />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Ordem de Serviço
            </p>
            <p className="font-display text-2xl font-bold text-navy dark:text-navy">
              OS {os.number}
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge
            variant="outline"
            className="text-black border-black/40 font-medium print:text-xs"
          >
            {OS_STATUS_LABEL[os.status] ?? os.status}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            Aberta em {formatDateTime(os.openedAt)}
          </p>
        </div>
      </div>

      {/* Cliente e veículo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Cliente
          </h3>
          <p className="font-semibold">{os.customerName ?? "—"}</p>
          {(os.customerWhatsapp || os.customerPhone) && (
            <p className="text-sm text-muted-foreground">
              {os.customerWhatsapp ?? os.customerPhone}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Veículo
          </h3>
          <p className="font-semibold">
            {os.vehicleBrand ?? ""} {os.vehicleModel ?? ""}
          </p>
          {os.vehiclePlate && (
            <Badge variant="outline" className="mt-1 text-black border-black/40 font-mono">
              {os.vehiclePlate}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {[os.vehicleYear, os.vehicleColor].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        {os.mileage != null && (
          <p className="text-sm">
            <span className="font-medium">Quilometragem: </span>
            {Number(os.mileage).toLocaleString("pt-BR")} km
          </p>
        )}
        {os.predictedAt && (
          <p className="text-sm">
            <span className="font-medium">Previsão: </span>
            {formatDateTime(os.predictedAt)}
          </p>
        )}
        {os.completedAt && (
          <p className="text-sm">
            <span className="font-medium">Concluída em: </span>
            {formatDateTime(os.completedAt)}
          </p>
        )}
      </div>

      {/* Serviços */}
      <h3 className="text-sm font-bold uppercase tracking-wider border-b border-black/20 pb-1 mb-2">
        Serviços (mão de obra)
      </h3>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">Nenhum serviço registrado.</p>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Descrição</th>
              <th className="py-1 font-medium text-right w-16">Qtd</th>
              <th className="py-1 font-medium text-right w-28">Unitário</th>
              <th className="py-1 font-medium text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-t border-black/10">
                <td className="py-1.5">{s.description}</td>
                <td className="py-1.5 text-right">{s.quantity}</td>
                <td className="py-1.5 text-right">{formatBRL(s.unitPrice)}</td>
                <td className="py-1.5 text-right font-medium">{formatBRL(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Peças */}
      <h3 className="text-sm font-bold uppercase tracking-wider border-b border-black/20 pb-1 mb-2">
        Peças aplicadas
      </h3>
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">Nenhuma peça registrada.</p>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Descrição</th>
              <th className="py-1 font-medium text-right w-16">Qtd</th>
              <th className="py-1 font-medium text-right w-28">Unitário</th>
              <th className="py-1 font-medium text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-black/10">
                <td className="py-1.5">
                  {p.description}
                  {p.discount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      (desconto {formatBRL(p.discount)})
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right">{p.quantity}</td>
                <td className="py-1.5 text-right">{formatBRL(p.unitPrice)}</td>
                <td className="py-1.5 text-right font-medium">{formatBRL(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Diagnóstico */}
      {os.diagnostics && (
        <>
          <h3 className="text-sm font-bold uppercase tracking-wider border-b border-black/20 pb-1 mb-2 mt-4">
            Diagnóstico
          </h3>
          <p className="text-sm whitespace-pre-wrap mb-4">{os.diagnostics}</p>
        </>
      )}

      {/* Observações */}
      {os.observations && (
        <>
          <h3 className="text-sm font-bold uppercase tracking-wider border-b border-black/20 pb-1 mb-2 mt-4">
            Observações
          </h3>
          <p className="text-sm whitespace-pre-wrap mb-4">{os.observations}</p>
        </>
      )}

      {/* Total */}
      <div className="mt-6 border-t-2 border-black pt-4 flex items-center justify-between">
        <p className="font-display text-2xl font-bold text-navy dark:text-navy">
          TOTAL
        </p>
        <div className="text-right">
          {os.discount > 0 && (
            <p className="text-sm text-muted-foreground">
              Desconto: −{formatBRL(os.discount)}
            </p>
          )}
          <p className="font-display text-3xl font-bold">{formatBRL(os.totalAmount)}</p>
        </div>
      </div>

      {/* Assinaturas */}
      <div className="mt-16 grid grid-cols-2 gap-16">
        <div className="border-t border-black pt-2 text-center">
          <p className="text-sm font-medium">Oficina</p>
        </div>
        <div className="border-t border-black pt-2 text-center">
          <p className="text-sm font-medium">Cliente</p>
        </div>
      </div>
    </div>
  );
}
